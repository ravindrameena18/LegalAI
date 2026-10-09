cd C:\Users\MEENA\Desktop\LegalAI
.\.venv\Scripts\Activate.ps1
cd services\api
python -m uvicorn app.main:app --reload --port 8000


cd C:\Users\MEENA\Desktop\LegalAI\apps\web
npm run dev


http://localhost:3000/dashboard