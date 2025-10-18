# ThreadCount

## Project Overview

ThreadCount is a full-stack application that uses a machine learning model to detect objects in images. The frontend is a React application that allows users to upload an image. The backend is a Flask server that uses the Moondream model to perform object detection.

## Setup

### Backend

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```

2.  Create a virtual environment:
    ```bash
    python -m venv venv
    ```

3.  Activate the virtual environment:
    -   On Windows:
        ```bash
        venv\Scripts\activate
        ```
    -   On macOS and Linux:
        ```bash
        source venv/bin/activate
        ```

4.  Install or update the required dependencies:
    ```bash
    pip install -r requirements.txt
    ```

5.  I have created a `.env` file for you in the `backend` directory. Open this file and add your Moondream API key:
    ```
    MOONDREAM_API_KEY="your_api_key"
    ```
    Replace `"your_api_key"` with your actual Moondream API key.

### Frontend

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```

2.  Install the required dependencies:
    ```bash
    npm install
    ```

## Running the application

### Backend

1.  Navigate to the `backend` directory and activate the virtual environment if you haven't already.
2.  Run the Flask application.

    *   **With HTTPS (recommended for local testing with frontend HTTPS):**
        ```bash
        # Ensure you are in the 'backend/' directory when running this command.
        # The certificate files are located in the 'frontend/' directory.
        flask --app main run --host=0.0.0.0 --port=5000 --cert=../frontend/localhost+3.pem --key=../frontend/localhost+3-key.pem
        ```

    *   **Alternatively, for simpler local HTTP testing (may cause mixed content warnings if frontend is HTTPS):**
        ```bash
        flask --app main run --host=0.0.0.0 --port=5000
        ```

    The backend will be running at `https://<your-local-ip>:5000` (or `http://<your-local-ip>:5000` if using the HTTP option). You can find your local IP address by running `ifconfig` (on macOS/Linux) or `ipconfig` (on Windows). For example, if your IP address is `192.168.4.88`, you would access the server at `https://192.168.4.88:5000`.

    **Note on HTTPS:** To enable HTTPS, you need to provide a certificate and a key file. The command above uses the certificate and key files located in the `frontend` directory. These are for local development only and should not be used in production.

    You can generate your own self-signed certificate and key using `openssl`:
    ```bash
    openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365
    ```
    This will create `cert.pem` and `key.pem` files. You can then update the `flask run` command to use these files.

### Frontend

1.  Navigate to the `frontend` directory.
2.  Start the React application with HTTPS:
    ```bash
    HTTPS=true npm start
    ```
    The frontend development server will start, and you can view the application in your browser at `https://localhost:3000`.

    To access the application from other devices on the same network (like your phone), replace `localhost` with your computer's local IP address. For example, if your IP address is `192.168.4.88`, you would use `https://192.168.4.88:3000`.