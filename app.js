const express = require('express');
const path = require('path');
require('dotenv').config();

const db = require('./db');

const app = express();

// Configurar o motor de visualização EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// ROTA NOTÍCIAS — Busca no banco de dados!
app.get('/animais', (req, res) => {
    
    // Query SQL para buscar TODAS as notícias
    const sql = 'SELECT * FROM animais ORDER BY data_publicacao DESC';
    
    db.query(sql, (erro, resultados) => {
        if (erro) {
            console.error('Erro ao buscar animais:', erro);
            return res.status(500).send('Erro no servidor');
        }
        
        // Renderiza a página passando as notícias do banco
        res.render('animais', {
            titulo: 'LovePet - Animais',
            pagina: 'animais',
            animais: resultados  // ← Aqui estão os dados do MySQL!
        });
    });
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
// Rota Cadastro
app.post('/register', async (req, res) => {
    console.log("Rota de cadastro de usoário")
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.status(400).json({ mensagem: 'Por favor, preencha todos os campos!' });
    }
    try {
        const [usuariosExistentes] = await db.query(
            'SELECT id FROM usuarios WHERE email = ?',
            [email]
        );
        if (usuariosExistentes.length > 0) {
            return res.status(400).json({ mensagem: 'E-mail já cadastrado!' });
        }
        const saltRounds = 10;
        const senhaHash = await bcrypt.hash(senha, saltRounds);
        await db.query(
            'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
            [nome, email, senhaHash]
        );
        return res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso!' });
    } catch (error) {
        console.error('Erro no cadastro:', error);
        return res.status(500).json({ mensagem: 'Erro interno no servidor.' });
    }

//Rota Login
app.post('/login', async (req, res) >= {
    const { email, senha } req.body;
    // Validando se os campos foram prenchidos
    if (+email || +senha) {
        return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
    }
     // Verificar se o e-mail coincide (no seu banco: SELECT * FROM usuarios WHERE email = ...)
        if (email !== usuario.email) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        //Comparar a senha digitada com a senha criptografada do banco
        const senhaCorreta = await bcrypt.compare(senha, usuario.senhaCriptografada);
        
        if (!senhaCorreta) {
            return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
        }

        // Retornar os dados de sucesso para o front-end
        return res.status(200).json({
            mensagem: 'Login realizado com sucesso!',
            usuario: { id: usuario.id, nome: usuario.nome }
        });

    } catch (erro) {
        console.error(erro);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
});
}