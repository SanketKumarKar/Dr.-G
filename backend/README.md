# Python Backend Setup

## Prerequisites
- Python 3.9+ installed
- OpenAI API Key

## Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Create a virtual environment (optional but recommended):**
    ```bash
    python -m venv venv
    .\venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Configure Environment Variables:**
    - Ensure your `.env` file in the root directory (`../.env`) has your `OPENAI_API_KEY`.
    - Example `.env`:
        ```
        OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
        ```

## Running the Server

Run the server using `uvicorn`:

```bash
uvicorn app:app --reload
```

The server will start at `http://localhost:8000`.
The API endpoint is available at `http://localhost:8000/api/apsa`.

## Running the Frontend

In a separate terminal, run the frontend as usual:

```bash
npm run dev
```

The frontend will proxy requests from `http://localhost:5173/api` to `http://localhost:8000/api`.
