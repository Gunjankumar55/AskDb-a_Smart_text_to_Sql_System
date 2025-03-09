from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from decouple import config
import google.generativeai as genai
import json
import logging
import traceback
import csv
import re
import datetime
import os
import pandas as pd
import pandasql as ps
from werkzeug.utils import secure_filename
import tempfile
import base64

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Configure handlers if they don't exist
if not logger.handlers:
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

# Initialize Gemini API
try:
    genai.configure(api_key=config('GEMINI_API_KEY'))
    # List models for debugging
    for m in genai.list_models():
        logger.info(f"Available model: {m.name}")
    model = genai.GenerativeModel('models/gemini-1.5-pro-latest')  # Use a specific, available model
    logger.info("✅ Gemini API initialized successfully with model: models/gemini-1.5-pro-latest")
except Exception as e:
    logger.error(f"❌ Error initializing Gemini API: {e}")
    # Handle the initialization error gracefully, e.g., by setting a flag
    gemini_initialized = False

app = Flask(__name__)
CORS(app)
app.config['TEMPLATES_AUTO_RELOAD'] = True

# File upload configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'csv', 'json'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Data storage
DATA = []
SQL_QUERIES = {}
DF = None  # For storing pandas DataFrame

def allowed_file(filename):
    """Check if file has an allowed extension"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def load_data_from_file(file_path):
    """Load data from CSV or JSON file based on file extension"""
    global DF
    try:
        file_ext = file_path.rsplit('.', 1)[1].lower()
        
        if file_ext == 'json':
            with open(file_path, 'r') as f:
                data = json.load(f)
                # Handle both formats: plain array or {data: [...], sql_queries: {...}}
                if isinstance(data, list):
                    DF = pd.DataFrame(data)
                    return data, {}
                elif isinstance(data, dict):
                    DF = pd.DataFrame(data.get('data', []))
                    return data.get('data', []), data.get('sql_queries', {})
                else:
                    raise ValueError("Invalid JSON structure")
                
        elif file_ext == 'csv':
            # Use pandas to read CSV
            DF = pd.read_csv(file_path)
            # Convert DataFrame to list of dictionaries
            data = DF.to_dict(orient='records')
            return data, {}
            
        else:
            raise ValueError(f"Unsupported file format: {file_ext}")
            
    except Exception as e:
        logger.error(f"❌ Error loading data from {file_path}: {str(e)}")
        logger.error(traceback.format_exc())
        raise

def get_sql_from_gemini(query, columns=None):
    """
    Get SQL query from Gemini AI or retrieve from loaded SQL queries.
    """
    try:
        # Attempt to retrieve from loaded queries
        if query in SQL_QUERIES:
            sql_query = SQL_QUERIES[query]
            logger.info(f"✅ Retrieved SQL query from loaded data for query: {query}")
            return sql_query

        # If not found, generate using Gemini
        if columns:
            # Use columns information for more accurate query generation
            prompt = f"""
            You are an expert SQL query generator. Your job is to take a plain English question 
            and return a single SQL query that answers that question. You will be provided 
            with a description of the SQL database schema.

            Here are the details of the table:
            - Table Name: data
            - Columns: {', '.join(columns)}

            Here are some examples of questions and corresponding SQL queries:
            - Question: Show all records.
              SQL: SELECT * FROM data;
            - Question: What is the average value of column 'amount'?
              SQL: SELECT AVG(amount) FROM data;
            - Question: Show records where 'city' is 'Mumbai'.
              SQL: SELECT * FROM data WHERE city = 'Mumbai';

            Now, generate the SQL query for the following question:
            Question: {query}

            Important notes:
            - Only return a single SQL query.
            - Always start the SQL query with SELECT.
            - Use only the column names provided.
            - Do not include any explanations or descriptive text.
            - Enclose string values in single quotes.
            """
        else:
            prompt = f"""
            You are an expert SQL query generator.  Your job is to take a plain English question
            and return a single SQL query that answers that question.

            Here are some examples of questions and corresponding SQL queries:
            - Question: Show all records.
              SQL: SELECT * FROM data;
            - Question: How many records are there?
              SQL: SELECT COUNT(*) FROM data;

            Now, generate the SQL query for the following question:
            Question: {query}

            Important notes:
            - Only return a single SQL query.
            - Always start the SQL query with SELECT.
            - Do not include any explanations or descriptive text.
            - Enclose string values in single quotes.
            """

        response = model.generate_content(prompt)
        sql_query = response.text.strip()

        # Basic safety checks
        sql_lower = sql_query.lower()
        if any(word in sql_lower for word in ['insert', 'update', 'delete', 'drop', 'truncate', 'alter']):
            raise ValueError("Only SELECT statements are allowed")

        if not sql_lower.startswith('select'):
            raise ValueError("Query must start with SELECT")

        # Clean up the query
        sql_query = sql_query.replace('`', '')  # Remove backticks
        sql_query = sql_query.replace('"', "'")  # Replace double quotes with single quotes
        sql_query = sql_query.replace('\n', ' ')  # Remove newlines
        sql_query = ' '.join(sql_query.split())  # Remove extra spaces

        # Remove 'sql' prefix if present
        if sql_query.lower().startswith('sql'):
            sql_query = sql_query[3:].strip()

        logger.info(f"Generated SQL query: {sql_query}")
        return sql_query

    except Exception as e:
        logger.error(f"Error generating SQL: {str(e)}")
        logger.error(traceback.format_exc())
        raise ValueError(f"Error generating SQL query: {str(e)}")


def execute_sql_query(sql_query):
    """Execute SQL query on the loaded DataFrame"""
    global DF
    if DF is None:
        raise ValueError("No data loaded. Please upload a file first.")
    
    try:
        # Use pandasql to execute the query
        result = ps.sqldf(sql_query, locals())
        return result.to_dict(orient='records')
    except Exception as e:
        logger.error(f"Error executing SQL query: {str(e)}")
        raise ValueError(f"Error executing SQL query: {str(e)}")

def generate_summary(data):
    """Generate a simple summary of the data"""
    if not data:
        return "No data available."
    
    try:
        num_records = len(data)
        fields = list(data[0].keys()) if num_records > 0 else []
        
        return f"Found {num_records} records with {len(fields)} fields."
    except Exception as e:
        logger.error(f"Error generating summary: {str(e)}")
        return "Summary generation failed."

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/combined', methods=['GET'])
def combined_page():
    return render_template('combined.html')

@app.route('/api/upload', methods=['POST'])
def api_upload_file():
    global DATA, SQL_QUERIES, DF
    
    # Check if the post request has the file part
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file part'})
    
    file = request.files['file']
    
    # If user does not select file, browser also
    # submit an empty part without filename
    if file.filename == '':
        return jsonify({'success': False, 'error': 'No selected file'})
    
    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        try:
            file.save(file_path)
            logger.info(f"File saved successfully to: {file_path}")
        except Exception as e:
            logger.error(f"Error saving file: {e}")
            return jsonify({'success': False, 'error': f'Error saving file: {str(e)}'})
        
        try:
            # Load data from the file
            DATA, SQL_QUERIES = load_data_from_file(file_path)
            logger.info(f"✅ Successfully loaded data from {filename}")
            
            # Get column information for the DataFrame
            columns = list(DF.columns) if DF is not None else []
            
            return jsonify({
                'success': True, 
                'message': f'File {filename} uploaded and processed successfully',
                'record_count': len(DATA),
                'columns': columns,
                'sample': DATA[:5] if DATA else []
            })
        except Exception as e:
            logger.error(f"❌ Error processing file: {str(e)}")
            return jsonify({'success': False, 'error': f'Error processing file: {str(e)}'})
    else:
        return jsonify({'success': False, 'error': 'File type not allowed'})

@app.route('/api/query', methods=['POST'])
def api_query():
    try:
        data = request.json
        user_query = data.get('query', '')
        logger.info(f"Received user query: {user_query}")

        if not DF is not None and len(DATA) == 0:
            return jsonify({
                'success': False,
                'error': 'No data loaded. Please upload a file first.'
            })

        # Get columns for better query generation
        columns = list(DF.columns) if DF is not None else None
        
        # Get SQL from Gemini API
        sql_query = get_sql_from_gemini(user_query, columns)
        logger.info(f"Generated SQL query: {sql_query}")

        # Execute the SQL query using pandasql
        try:
            results = execute_sql_query(sql_query)
            logger.info(f"Query returned {len(results)} results")
            
            return jsonify({
                'success': True,
                'sql_query': sql_query,
                'data': results
            })
        except Exception as e:
            # If pandasql execution fails, fall back to the simplified approach
            logger.warning(f"SQL execution failed, falling back to simplified filtering: {str(e)}")
            
            # Very simplified filtering logic
            results = []
            if 'where' in sql_query.lower():
                # Extract conditions from the query (very basic approach)
                conditions = sql_query.lower().split('where')[1].strip()
                
                # Apply simple filtering based on conditions
                for item in DATA:
                    # This is an extremely simplified filter
                    match = True
                    for key, value in item.items():
                        if key.lower() in conditions and str(value).lower() not in conditions:
                            match = False
                            break
                    
                    if match:
                        results.append(item)
            else:
                # If no WHERE clause, return all data
                results = DATA
            
            if not results:
                logger.warning("Query returned no results")
                
            return jsonify({
                'success': True,
                'sql_query': sql_query,
                'data': results,
                'note': 'Used simplified filtering as SQL execution failed'
            })

    except Exception as e:
        logger.error(f"Error in query endpoint: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            'success': False,
            'error': str(e),
            'sql_query': sql_query if 'sql_query' in locals() else None
        }), 500

@app.route('/api/suggest', methods=['POST'])
def api_suggest_queries():
    user_input = request.json['input']
    
    # Get column names if available
    columns = list(DF.columns) if DF is not None else []
    
    if columns:
        # Generate suggestions based on actual columns
        suggestions = [
            f"Show all records where {columns[0]} contains {user_input}",
            f"Count records grouped by {columns[0]}",
            f"Find maximum value of {columns[0]}",
            f"Show records sorted by {columns[0]}"
        ]
    else:
        # Default suggestions
        suggestions = [
            "Show all customers from " + user_input,
            "Find transactions above " + user_input,
            "List loans with interest rate less than " + user_input,
            "Show credit scores higher than " + user_input
        ]
    
    return jsonify(suggestions)

@app.route('/api/audio-query', methods=['POST'])
def api_audio_query():
    # This is a placeholder for audio processing
    # In a real implementation, you would:
    # 1. Receive the audio file
    # 2. Use a transcription service to convert to text
    # 3. Process the text query
    
    # For now, just extract the query from the request
    data = request.json
    transcribed_text = data.get('transcription', '')
    
    if not transcribed_text:
        return jsonify({
            'success': False,
            'error': 'No transcription provided'
        })
    
    # Process the transcribed text as a regular query
    try:
        columns = list(DF.columns) if DF is not None else None
        sql_query = get_sql_from_gemini(transcribed_text, columns)
        
        # Execute the SQL query
        results = execute_sql_query(sql_query)
        
        return jsonify({
            'success': True,
            'transcription': transcribed_text,
            'sql_query': sql_query,
            'data': results
        })
    except Exception as e:
        logger.error(f"Error processing audio query: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'transcription': transcribed_text
        })
    
@app.route('/list_models')
def list_models():
    models = genai.list_models()
    model_info = []
    for m in models:
        model_info.append({
            'name': m.name,
            'description': m.description,
            'supported_methods': m.supported_generation_methods
        })
    return jsonify(model_info)

if __name__ == '__main__':
    app.run(debug=True)
