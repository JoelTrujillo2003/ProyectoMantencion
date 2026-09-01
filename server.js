import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!process.env.GEMINI_API_KEY) {
  console.error("ADVERTENCIA: No se encontró la GEMINI_API_KEY en el archivo .env");
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ORDEN ESTRICTA: Formato encapsulado para que el frontend lo convierta en diseño visual
const SYSTEM_INSTRUCTION = `
Eres el Jefe de Mecánicos de un taller Premium en Chile. Tu diagnóstico debe ser impactante, profesional y directo al grano, sin ser aburrido.
REGLA DE FORMATO ESTRICTA Y OBLIGATORIA:
DEBES responder EXACTAMENTE usando estas tres etiquetas (y nada más fuera de ellas):

[ESTADO]
(Escribe aquí 2 a 3 líneas con una evaluación experta e interesante sobre cómo está el vehículo con ese kilometraje. Sé directo).

[CRITICO]
(Escribe aquí 2 viñetas cortas, usando guiones, sobre las fallas inminentes o piezas a revisar urgentemente).

[MANTENIMIENTO]
(Escribe aquí 2 viñetas cortas, usando guiones, sobre qué repuestos cambiar o fluidos renovar ahora mismo).
`;

app.post('/api/analizar-vehiculo', async (req, res) => {
  try {
    const { type, brand, model, year, mileage, customQuery } = req.body;
    let userPrompt = `Analiza este vehículo: ${type} - Marca ${brand}, Modelo ${model}, Año ${year}, Kilometraje ${mileage} km.`;
    if (customQuery) userPrompt += `\nSíntoma o duda del cliente: ${customQuery}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: userPrompt,
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.3 }
    });

    res.json({ result: response.text });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ SERVIDOR ACTUALIZADO Y CORRIENDO EN http://localhost:${PORT}`));