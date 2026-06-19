# C:\Users\User\Downloads\MMU Lecture Note\FYP\Code\Testing - Copy

from urllib import request
from fastapi.staticfiles import StaticFiles
import io
import pandas as pd
import numpy as np
import shap
import joblib
import datetime
from pydantic import BaseModel
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
import os
from dotenv import load_dotenv
from groq import Groq

# --- LOAD SECURE ENVIRONMENT VARIABLES ---
load_dotenv()

# --- INITIALIZE GROQ API ---
api_key = os.environ.get("GROQ_API_KEY")
if api_key:
    groq_client = Groq(api_key=api_key)
    print("Groq API Client loaded successfully.")
else:
    print("WARNING: GROQ_API_KEY not found. AI features will be disabled.")
    groq_client = None

# --- ADD THIS LINE BACK ---
app = FastAPI()

# SECURITY BYPASS (Keep this if you already added it)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static directory to serve all JS and CSS files automatically
# app.mount("/static", StaticFiles(directory="static"), name="static")

# --- BOOT SEQUENCE ---
print("Loading Forecasting Model into memory...")
try:
    ml_model = joblib.load("forecast_model.pkl")
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Model could not be loaded. Ensure forecast_model.pkl is in the root directory. Error: {e}")
    ml_model = None
    
# --- NEW INGESTION PIPELINE ---
@app.post("/api/upload")
async def upload_and_process_data(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are permitted.")

    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        # 2. Basic Validation & Cleaning
        # Explicitly added Country to the contract
        required_cols = ['Order_Date', 'Category', 'Revenue', 'Profit', 'Product_Name', 'Region', 'Country']
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Missing required column: {col}")
        # Enforce strict data types
        df['Order_Date'] = pd.to_datetime(df['Order_Date'])
        df['Revenue'] = pd.to_numeric(df['Revenue'], errors='coerce').fillna(0)
        df['Profit'] = pd.to_numeric(df['Profit'], errors='coerce').fillna(0)
        
        # Sanitize string columns to prevent JSON serialization and Plotly rendering crashes
        df['Category'] = df['Category'].fillna("Unknown Category").astype(str)
        df['Product_Name'] = df['Product_Name'].fillna("Unknown Product").astype(str)
        df['Region'] = df['Region'].fillna("Unknown Region").astype(str)
        df['Country'] = df['Country'].fillna("Unknown").astype(str) # SECURED NATIVE COLUMN
        
        # Convert history for the frontend
        df['Order_Date_Str'] = df['Order_Date'].dt.strftime('%Y-%m-%d')
        history_data = df.drop(columns=['Order_Date']).rename(columns={'Order_Date_Str': 'Order_Date'}).to_dict(orient="records")
        # 3. FORECAST INFERENCE & XAI PIPELINE
        forecast_data = []
        shap_payload = [] # Holds the Explainable AI data
        
        if ml_model is not None:
            try:
                daily_revenue = df.groupby('Order_Date')['Revenue'].sum().sort_index()
                
                if len(daily_revenue) >= 7:
                    history_window = daily_revenue.tail(7).tolist()
                    current_date = daily_revenue.index[-1]
                    
                    X_forecast_list = [] # Store features to explain later
                    
                    # A. The Autoregressive Loop
                    for i in range(1, 91):
                        current_date += pd.Timedelta(days=1)
                        lag_1 = history_window[-1]
                        lag_7 = history_window[-7]
                        
                        recent_series = pd.Series(history_window[-7:])
                        rolling_mean = recent_series.mean()
                        rolling_std = recent_series.std()
                        if pd.isna(rolling_std): rolling_std = 0.0
                            
                        X_pred = pd.DataFrame([{
                            'DayOfWeek': current_date.dayofweek,
                            'Month': current_date.month,
                            'Lag_1': lag_1,
                            'Lag_7': lag_7,
                            'Rolling_7_Mean': rolling_mean,
                            'Rolling_7_Std': rolling_std
                        }])
                        
                        X_forecast_list.append(X_pred)
                        
                        pred_revenue = max(0, float(ml_model.predict(X_pred)[0]))
                        history_window.append(pred_revenue)
                        
                        forecast_data.append({
                            "Date": current_date.strftime('%Y-%m-%d'),
                            "Forecast_Revenue": pred_revenue
                        })
                    
                    # B. EXPLAINABLE AI (SHAP) ENGINE
                    try:
                        # Combine all 90 predicted days into one matrix
                        X_all = pd.concat(X_forecast_list, ignore_index=True)
                        
                        # Run SHAP TreeExplainer
                        explainer = shap.TreeExplainer(ml_model)
                        shap_values = explainer.shap_values(X_all)
                        
                        # Calculate mean absolute impact across all 90 days
                        mean_abs_shap = np.abs(shap_values).mean(axis=0)
                        
                        # Map raw columns to human-readable names
                        feature_map = {
                            'Rolling_7_Mean': '7-Day Revenue Trend',
                            'Lag_1': "Yesterday's Revenue",
                            'Lag_7': 'Same Day Last Week',
                            'DayOfWeek': 'Day of the Week',
                            'Month': 'Seasonality (Month)',
                            'Rolling_7_Std': 'Revenue Volatility'
                        }
                        
                        features = X_all.columns.tolist()
                        for f, val in zip(features, mean_abs_shap):
                            shap_payload.append({
                                "feature": feature_map.get(f, f),
                                "impact": float(val)
                            })
                            
                        # Sort by highest impact
                        shap_payload = sorted(shap_payload, key=lambda x: x["impact"], reverse=True)
                    except Exception as shap_err:
                        print(f"--- SHAP CALCULATION FAILED: {str(shap_err)} ---")

            except Exception as model_err:
                print(f"--- MODEL INFERENCE FAILED: {str(model_err)} ---")
                
        return {
            "history": history_data,
            "forecast": forecast_data,
            "shap_data": shap_payload # Return XAI to frontend
        }

    except Exception as e:
        print(f"--- INGESTION ERROR: {str(e)} ---")
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")

# ==========================================
# API HEALTH CHECK (CLOUD NATIVE)
# ==========================================
@app.get("/")
def read_root():
    """API Health Check for Hugging Face Space"""
    return {
        "status": "healthy", 
        "architecture": "decoupled", 
        "message": "Retail Forecasting API Backend Online"
    }

# ==========================================
# AI COPILOT & NLG ENDPOINTS (GROQ API)
# ==========================================

class ChatRequest(BaseModel):
    message: str
    context: dict

@app.post("/api/chat")
async def chat_with_copilot(request: ChatRequest):
    if groq_client is None:
        return {"response": "⚠️ AI disabled: API key missing."}
        
    try:
        system_prompt = f"""
        You are an elite, cynical Retail Performance Architect and Operator. Your job is to audit the provided transaction context and give direct, hyper-actionable commercial strategy.

        STRICT BEHAVIORAL CONSTRAINTS:
        1. Do not include conversational fluff. No "Hello!", "Sure, let me look at that". Jump straight into data analysis.
        2. Never hallucinate numbers. You may ONLY reference metrics explicitly listed in the active context below. 
        3. For every claim, you MUST cite the exact raw dollar figure or percentage to prove it.
        4. Focus heavily on margin leakage, asset velocity, and clear structural dependencies.

        CURRENT OPERATIONS METADATA:
        - View Window: {request.context.get('dateRange')}
        - Global Filter State: Category Selector = [{request.context.get('category')}], Regional Selector = [{request.context.get('region')}]
        
        FINANCIAL PERFORMANCE MATRIX:
        - Absolute Gross Revenue: {request.context.get('revenue')}
        - Net Operational Profit: {request.context.get('profit')}
        - Composite Margin Rate: {request.context.get('margin')}
        
        STRUCTURAL SEGMENTATION DATA:
        - Category Breakdown: {request.context.get('categoryData')}
        - Regional Velocity: {request.context.get('regionalData')}
        - Top 3 Generating Products: {request.context.get('topProducts')}
        - Operational Extremes: {request.context.get('businessInsights')}

        OUTPUT PROTOCOL:
        Address the user's specific query directly. Conclude with a singular high-leverage operator directive.
        """
        
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": request.message}
            ],
            model="llama-3.1-8b-instant", 
        )
        return {"response": chat_completion.choices[0].message.content.strip()}
        
    except Exception as e:
        print(f"--- GROQ CHAT CRASHED: {str(e)} ---")
        return {"response": "⚠️ Cloud AI is temporarily unreachable."}


class InsightRequest(BaseModel):
    chart_type: str
    context: str

@app.post("/api/insight")
async def generate_chart_insight(request: InsightRequest):
    if groq_client is None:
        return {"insight": "⚠️ AI disabled: API key missing."}
        
    try:
        system_prompt = f"""
        You are an elite Retail Analyst. Summarize the following {request.chart_type} data in EXACTLY TWO SENTENCES.
        
        RULES:
        1. Maximum 2 sentences.
        2. Point out the single most important metric or highest-leverage vulnerability.
        3. DO NOT use introductory fluff. Be ruthless, commercial, and direct.
        
        DATA CONTEXT:
        {request.context}
        """

        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Analyze the data context and provide the summary."}
            ],
            model="llama-3.1-8b-instant", 
        )
        return {"insight": chat_completion.choices[0].message.content.strip()}

    except Exception as e:
        print(f"--- GROQ INSIGHT CRASHED: {str(e)} ---")
        return {"insight": "⚠️ Failed to generate insight. Cloud AI timeout."}