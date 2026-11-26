const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();

const db = require('./db');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'lovepet_chave_secreta_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000, secure: false }
}));

app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Função auxiliar para buscar animais com Saúde e Social
async function buscarAnimais(apenasDisponiveis = false) {
    const filtro = apenasDisponiveis ? 'WHERE a.disponivel = TRUE' : '';
    const [rows] = await db.query(`
        SELECT a.*, s.vacinado, s.castrado, soc.sociavel, soc.breve_descricao 
        FROM Animal a
        LEFT JOIN Saude s ON a.animal_id = s.id_animal
        LEFT JOIN Social soc ON a.animal_id = soc.id_animal
        ${filtro}
        ORDER BY a.animal_id DESC
    `);
    return rows;
}

// ============================================
// INÍCIO E LISTA DE ANIMAIS
// ============================================

app.get('/', async (req, res) => {
    try {
        const animais = await buscarAnimais(true);
        res.render('index', { titulo: 'LovePet - Início', pagina: 'home', animais });
    } catch (erro) {
        console.error('Erro no início:', erro);
        res.render('index', { titulo: 'LovePet - Início', pagina: 'home', animais: [] });
    }
});

app.get('/animais', async (req, res) => {
    try {
        const animais = await buscarAnimais(false);
        res.render('animais', { titulo: 'LovePet - Animais', pagina: 'animais', animais });
    } catch (erro) {
        console.error('Erro em animais:', erro);
        res.status(500).send('Erro ao carregar animais.');
    }
});

// ============================================
// CADASTRAR NOVO ANIMAL (Aba Contato)
// ============================================

app.get('/contato', (req, res) => {
    res.render('contato', { titulo: 'LovePet - Cadastrar Animal', pagina: 'contato', mensagem: null });
});

app.post('/contato', async (req, res) => {
    const { nome, tipo, raca, sexo, porte, vacinado, castrado, sociavel, breve_descricao } = req.body;

    try {
        const [resAnimal] = await db.query(
            'INSERT INTO Animal (nome, tipo, raca, sexo, porte, id_abrigo, disponivel) VALUES (?, ?, ?, ?, ?, 1, TRUE)',
            [nome, tipo, raca || 'SRD', sexo, porte]
        );

        const id = resAnimal.insertId;

        await db.query(
            'INSERT INTO Saude (id_animal, vacinado, castrado, alergias, doencas, historico) VALUES (?, ?, ?, ?, ?, ?)',
            [id, vacinado === '1', castrado === '1', 'Nenhuma', 'Nenhuma', 'Cadastrado via sistema']
        );

        await db.query(
            'INSERT INTO Social (id_animal, sociavel, medos, breve_descricao) VALUES (?, ?, ?, ?)',
            [id, sociavel === '1', 'Nenhum', breve_descricao.substring(0, 150)]
        );

        res.redirect('/animais');
    } catch (erro) {
        console.error('Erro ao cadastrar animal:', erro);
        res.status(500).send('Erro ao cadastrar animal: ' + erro.message);
    }
});

// ============================================
// CADASTRO, LOGIN E LOGOUT
// ============================================

app.get(['/cadastro', '/register'], (req, res) => {
    res.render('cadastro', { titulo: 'LovePet - Cadastro', pagina: 'cadastro', error: null });
});

app.post(['/cadastro', '/register'], async (req, res) => {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
        return res.render('cadastro', { titulo: 'LovePet - Cadastro', pagina: 'cadastro', error: 'Preencha todos os campos.' });
    }

    try {
        const [existe] = await db.query('SELECT adotante_id FROM Adotante WHERE email = ?', [email]);
        if (existe.length > 0) {
            return res.render('cadastro', { titulo: 'LovePet - Cadastro', pagina: 'cadastro', error: 'E-mail já cadastrado!' });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        const username = (email.split('@')[0] + Math.floor(Math.random() * 100)).substring(0, 20);

        const [resultado] = await db.query(
            `INSERT INTO Adotante (nome, CPF, endereco, username, senha, telefone, email) 
             VALUES (?, '00000000000', 'Não informado', ?, ?, '0000000000', ?)`,
            [nome.substring(0, 45), username, senhaHash, email]
        );

        req.session.usuario = { id: resultado.insertId, nome, email };
        req.session.save(() => res.redirect('/solicitacoes'));
    } catch (erro) {
        console.error('Erro no cadastro:', erro);
        res.render('cadastro', { titulo: 'LovePet - Cadastro', pagina: 'cadastro', error: 'Erro ao cadastrar: ' + erro.message });
    }
});

app.get(['/login', '/entrar'], (req, res) => {
    res.render('login', { titulo: 'LovePet - Entrar', pagina: 'login', error: null });
});

app.post(['/login', '/entrar'], async (req, res) => {
    const { email, senha } = req.body;

    try {
        const [rows] = await db.query('SELECT * FROM Adotante WHERE email = ?', [email]);
        if (rows.length === 0 || !(await bcrypt.compare(senha, rows[0].senha))) {
            return res.render('login', { titulo: 'LovePet - Entrar', pagina: 'login', error: 'E-mail ou senha incorretos.' });
        }

        req.session.usuario = { id: rows[0].adotante_id, nome: rows[0].nome, email: rows[0].email };
        req.session.save(() => res.redirect('/solicitacoes'));
    } catch (erro) {
        console.error('Erro no login:', erro);
        res.render('login', { titulo: 'LovePet - Entrar', pagina: 'login', error: 'Erro ao realizar login.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

// ============================================
// SOLICITAÇÕES DE ADOÇÃO
// ============================================

app.get('/solicitacoes', async (req, res) => {
    try {
        const [solicitacoes] = await db.query(`
            SELECT s.*, a.nome AS nome_animal, a.tipo AS tipo_animal 
            FROM Solicitacao s 
            LEFT JOIN Animal a ON s.id_animal = a.animal_id 
            ORDER BY s.solicitacao_id DESC
        `);
        const [animaisDisponiveis] = await db.query(
            'SELECT animal_id, nome, tipo FROM Animal WHERE disponivel = TRUE ORDER BY nome ASC'
        );

        res.render('solicitacoes', {
            titulo: 'LovePet - Solicitações',
            pagina: 'solicitacoes',
            solicitacoes,
            animaisDisponiveis
        });
    } catch (erro) {
        console.error('Erro ao buscar solicitações:', erro);
        res.status(500).send('Erro ao carregar solicitações.');
    }
});

app.post('/solicitacoes', async (req, res) => {
    const { animal_id, nome_interessado, telefone, mensagem } = req.body;
    try {
        await db.query(
            'INSERT INTO Solicitacao (id_animal, nome_interessado, telefone, mensagem) VALUES (?, ?, ?, ?)',
            [animal_id, nome_interessado, telefone, mensagem || '']
        );
        await db.query('UPDATE Animal SET disponivel = FALSE WHERE animal_id = ?', [animal_id]);
        res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro ao criar solicitação:', erro);
        res.status(500).send('Erro ao enviar solicitação.');
    }
});

app.post('/solicitacoes/atualizar/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        await db.query('UPDATE Solicitacao SET status = ? WHERE solicitacao_id = ?', [status, id]);
        if (status === 'Recusada') {
            const [sol] = await db.query('SELECT id_animal FROM Solicitacao WHERE solicitacao_id = ?', [id]);
            if (sol.length > 0) {
                await db.query('UPDATE Animal SET disponivel = TRUE WHERE animal_id = ?', [sol[0].id_animal]);
            }
        }
        res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro ao atualizar solicitação:', erro);
        res.status(500).send('Erro ao atualizar.');
    }
});

app.post('/solicitacoes/deletar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const [sol] = await db.query('SELECT id_animal FROM Solicitacao WHERE solicitacao_id = ?', [id]);
        if (sol.length > 0) {
            await db.query('UPDATE Animal SET disponivel = TRUE WHERE animal_id = ?', [sol[0].id_animal]);
        }
        await db.query('DELETE FROM Solicitacao WHERE solicitacao_id = ?', [id]);
        res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro ao deletar solicitação:', erro);
        res.status(500).send('Erro ao excluir.');
    }
});

// ============================================
// INICIALIZAÇÃO
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em: http://localhost:${PORT}`));
