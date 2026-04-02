FROM python:3.11-slim
WORKDIR /app
COPY digital_twin_simulator.py .
COPY bldg59_digital_twin_jan2020_enriched.csv .
COPY .env .
RUN pip install --no-cache-dir pandas azure-iot-device python-dotenv
CMD ["python", "digital_twin_simulator.py"]