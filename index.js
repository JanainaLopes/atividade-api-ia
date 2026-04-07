require('dotenv').config();
const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const {API_KEY} = process.env;

const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(API_KEY);

// Rota principal de recomendações da Livraria Eficaz
app.post('/api/livraria/v1/recomendar', async (req, res) => {
    const { nome, idade, generoFavorito, nivelLeitura } = req.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Usuário: ${nome}, ${idade} anos, nível ${nivelLeitura}. Gosta de ${generoFavorito}.
            Atue como um livreiro expert. Sugira 5 livros que ele vá amar.
            Retorne APENAS um JSON: {"feedback": "texto curto", "livros": [{"titulo": "", "autor": "", "resumo": ""}]}
        `;

        const result = await model.generateContent(prompt);
        let texto = result.response.text().replace(/```json|```/g, "").trim();
        const dadosIA = JSON.parse(texto);

        // Busca de capas em paralelo (Performance e Objetividade)
        const livrosComCapas = await Promise.all(
            dadosIA.livros.map(async (livro) => {
                try {
                    const busca = encodeURIComponent(`${livro.titulo} ${livro.autor}`);
                    const resp = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${busca}&maxResults=1`);
                    const data = await resp.json();
                    const capa = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail || "https://via.placeholder.com/150";
                    return { ...livro, capa: capa.replace("http://", "https://") };
                } catch {
                    return { ...livro, capa: "https://via.placeholder.com/150" };
                }
            })
        );

        // Resposta final em JSON estruturado
        res.status(200).json({
            status: "sucesso",
            usuario: nome,
            feedback_personalizado: dadosIA.feedback,
            recomendacoes: livrosComCapas,
            metadata: {
                data_acesso: new Date().toISOString(),
                versao_api: "1.0.0"
            }
        });

    } catch (error) {
       console.error("ERRO REAL:", error); // Isso vai aparecer no seu terminal (Preto)
       res.status(500).json({ erro: error.message }); // Isso vai aparecer no Postman
    }
});

app.listen(3000, () => console.log("Livraria Eficaz Online na porta 3000"));