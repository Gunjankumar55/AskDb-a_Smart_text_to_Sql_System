# AskDB - A smart Natural Language to SQL Converter

## 🌟 Overview

AskDB is a powerful tool that converts natural language questions into SQL queries, making databases accessible to non-technical users. Simply upload your data, ask questions in plain English, and get instant SQL queries and results.

## ✨ Features

- **🗣️ Natural Language Processing**: Ask questions in plain English and get SQL queries
- **📊 Data Visualization**: Interactive charts for query results
- **📁 Export Options**: Export results as CSV, JSON, or PDF
- **🎨 Modern UI**: Responsive design with dark mode
- **📤 File Upload**: Support for CSV and JSON data files
- **🧠 AI-Powered**: Utilizes Google's Gemini 1.5 Pro LLM for accurate query generation

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript, Bootstrap 5, Chart.js
- **Backend**: Python Flask, Flask-CORS
- **AI**: Google Gemini 1.5 Pro
- **Data Processing**: Pandas, PandaSQL

## 📷 Screenshots

![AskDB Interface](https://raw.githubusercontent.com/Gunjankumar55/askDB---Smart-text-to-sql-/main/screenshots/demo.png)

## 🚀 Getting Started

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/Gunjankumar55/askDB---Smart-text-to-sql-.git
   cd askDB---Smart-text-to-sql-
   ```

2. Create a virtual environment:
   ```
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

4. Create a `.env` file with your API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

5. Run the application:
   ```
   python app.py
   ```

6. Open your browser and navigate to `http://localhost:5000`

## 🔍 How It Works

1. **Upload Data**: Upload your CSV or JSON data file
2. **Ask Questions**: Type your question in natural language
3. **Get Results**: View the generated SQL query and results
4. **Visualize**: Create charts and export data in various formats

## 🌐 Demo

Try the live demo at [Hugging Face Spaces](https://huggingface.co/spaces/gkc55/AskDb)

## 👨‍💻 Author

**Gunjankumar Choudhari** - [GitHub](https://github.com/Gunjankumar55)


