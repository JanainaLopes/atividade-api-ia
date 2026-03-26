const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// Configure sua chave de API aqui
const genAI = new GoogleGenerativeAI("AIzaSyAKRb2Hctk1gdAjkuO2mntP9N-1D6dmsQg");

// Gabarito Simulado (10 perguntas de Literatura/Livraria)
const gabarito = ["A", "B", "C", "A", "D", "B", "C", "A", "B", "D"];

app.post('/api/quiz/resultado', async (req, res) => {
    const { nome, dataNascimento, nivelLeitura, respostas } = req.body;

    // 1. Calcular Pontuação
    let acertos = 0;
    respostas.forEach((resp, index) => {
        if (resp.toUpperCase() === gabarito[index]) acertos++;
    });

    // 2. Gerar Feedback Personalizado com Gemini
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            O usuário ${nome}, nível de leitura ${nivelLeitura}, nascido em ${dataNascimento}, 
            acertou ${acertos} de 10 perguntas em um quiz de literatura.
            Gere um feedback curto (máximo 3 frases) e motivador, recomendando um estilo de livro 
            que combine com o desempenho e o nível dele.
        `;

        const result = await model.generateContent(prompt);
        const feedbackIA = result.response.text();

        // 3. Retorno em JSON
        res.json({
            usuario: {
                nome,
                nivelLeitura,
                idade: calcularIdade(dataNascimento)
            },
            score: {
                totalPerguntas: 10,
                acertos: acertos,
                percentual: (acertos / 10) * 100 + "%"
            },
            feedbackPersonalizado: feedbackIA.trim(),
            status: acertos >= 6 ? "Expert" : "Aprendiz"
        });

    } catch (error) {
        res.status(500).json({ error: "Erro ao gerar feedback com Gemini." });
    }
});

// Rota para recomendação personalizada de livros
app.post('/api/recomendacoes', async (req, res) => {
    const { nome, idade, generoLiterario, frequenciaLeitura } = req.body;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Sugira 10 livros para ${nome}, ${idade} anos, que gosta de ${generoLiterario}.
            Retorne APENAS um JSON no formato: 
            {"recomendacoes": [{"titulo": "nome", "autor": "nome", "resumo": "texto"}]}
        `;

        const result = await model.generateContent(prompt);
        let textoResposta = result.response.text().replace(/```json|```/g, "").trim();
        
        // 1. Aqui temos o JSON inicial (sem capas)
        const dadosIA = JSON.parse(textoResposta);

        // 2. AGORA criamos a lista nova COM as capas
        // O Promise.all garante que o código ESPERE as 10 buscas terminarem
        const recomendacoesComCapas = await Promise.all(
            dadosIA.recomendacoes.map(async (livro) => {
                try {
                    const query = encodeURIComponent(`${livro.titulo} ${livro.autor || ''}`);
                    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`);
                    const data = await response.json();

                    // Pega a URL da capa ou uma imagem padrão
                    const capa = data.items?.[0]?.volumeInfo?.imageLinks?.thumbnail 
                                 || "https://via.placeholder.com/150?text=Sem+Capa";

                    return {
                        ...livro,
                        capa: capa.replace("http://", "https://") // Força HTTPS para segurança
                    };
                } catch (err) {
                    return { ...livro, capa: "https://via.placeholder.com/150?text=Erro+Capa" };
                }
            })
        );

        // 3. O res.json deve enviar o "recomendacoesComCapas", NÃO o "dadosIA"
        res.json({
            usuario: { nome, idade, generoLiterario, frequenciaLeitura },
            recomendacoes: recomendacoesComCapas // <--- IMPORTANTE: Usar a variável nova
        });

    } catch (error) {
        console.error("Erro:", error);
        res.status(500).json({ error: "Erro ao gerar recomendações." });
    }
});

function calcularIdade(data) {
    const nascimento = new Date(data);
    const hoje = new Date();
    return hoje.getFullYear() - nascimento.getFullYear();
}

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));