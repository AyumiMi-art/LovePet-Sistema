const express = require('express');
const path = require('path');
require('dotenv').config();

//const db = require('./db');

const app = express();

// Configurar o motor de visualização EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CONFIGURAÇÃO OBRIGATÓRIA: Permite que o Express leia os dados enviados via formulário POST
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos (CSS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// ROTAS
// ============================================

app.get('/', (req, res) => {
    res.render('index', { 
        titulo: 'LovePet - Início',
        pagina: 'home'
    });
});

// ============================================
// NOVAS ROTAS DE CADASTRO (ADICIONADAS AQUI)
// ============================================
app.get('/cadastro', (req, res) => {
    res.render('cadastro', { 
        titulo: 'LovePet - Criar Conta',
        pagina: 'cadastro',
        error: null 
    });
});

app.post('/cadastro', (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.render('cadastro', { 
            titulo: 'LovePet - Criar Conta',
            pagina: 'cadastro',
            error: 'Por favor, preencha todos os campos.' 
        });
    }

    // Redireciona para o login enviando os dados necessários do header
    res.render('login', { 
        titulo: 'LovePet - Acessar Conta',
        pagina: 'login',
        success: 'Cadastro realizado com sucesso! Faça login.', 
        error: null 
    });
});

// ============================================
// ROTAS DE LOGIN (ATUALIZADAS)
// ============================================
app.get('/login', (req, res) => {
    res.render('login', { 
        titulo: 'LovePet - Acessar Conta',
        pagina: 'login',
        error: null, 
        success: null 
    });
});

app.post('/login', (req, res) => {
    const { email, senha } = req.body;

    if (email !== "usuario@teste.com" || senha !== "123456") {
        return res.render('login', { 
            titulo: 'LovePet - Acessar Conta',
            pagina: 'login',
            error: 'E-mail ou senha inválidos.', 
            success: null 
        });
    }
    
    res.redirect('/');
});

// ROTA SOLICITAÇÕES
app.get('/solicitacoes', (req, res) => {
    
    // Query SQL para buscar TODAS as notícias
    //const sql = 'SELECT * FROM animais ORDER BY data_publicacao DESC';
    
    //db.query(sql, (erro, resultados) => {
    //    if (erro) {
    //        console.error('Erro ao buscar solicitações:', erro);
    //        return res.status(500).send('Erro no servidor');
    //    }
        
        // Renderiza a página passando dados vazios enquanto o banco está comentado
        res.render('solicitaçoes', {
            titulo: 'LovePet - Solicitaçoes',
            pagina: 'solicitaçoes',
            animais: []  // ← Modificado para array vazio temporariamente para não quebrar a página
        });
    //});
});

// ROTA CONTATO — Página de contato
app.get('/contato', (req, res) => {
    res.render('contato', {
        titulo: 'LovePet - Contato',
        pagina: 'contato'
    });
});

// ============================================
// INICIAR O SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});