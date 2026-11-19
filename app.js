const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
require('dotenv').config();

const db = require('./db');

const app = express();

// Leitura de dados enviados por formulários HTML e JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuração de Sessão
app.use(session({
    secret: process.env.SESSION_SECRET || 'lovepet_chave_secreta_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

// Disponibiliza 'usuario' em todas as views EJS
app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});

// Motor EJS e arquivos estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de proteção para rotas privadas
function verificarAutenticacao(req, res, next) {
    if (req.session && req.session.usuario) {
        return next();
    }
    return res.redirect('/login');
}

// ============================================
// ROTAS PÚBLICAS (GET)
// ============================================

app.get('/', async (req, res) => {
    try {
        const sql = `
            SELECT a.*, s.vacinado, s.castrado, soc.sociavel, soc.breve_descricao 
            FROM Animal a
            LEFT JOIN Saude s ON a.animal_id = s.id_animal
            LEFT JOIN Social soc ON a.animal_id = soc.id_animal
            WHERE a.disponivel = TRUE
            ORDER BY a.animal_id DESC
        `;
        const [resultados] = await db.query(sql);

        res.render('index', { 
            titulo: 'LovePet - Início',
            pagina: 'home',
            animais: resultados
        });
    } catch (erro) {
        console.error('Erro ao carregar início:', erro);
        res.render('index', { titulo: 'LovePet - Início', pagina: 'home', animais: [] });
    }
});



app.get('/animais', async (req, res) => {
    try {
        const sql = `
            SELECT a.*, s.vacinado, s.castrado, soc.sociavel, soc.breve_descricao 
            FROM Animal a
            LEFT JOIN Saude s ON a.animal_id = s.id_animal
            LEFT JOIN Social soc ON a.animal_id = soc.id_animal
            ORDER BY a.animal_id DESC
        `;
        const [resultados] = await db.query(sql);

        res.render('animais', {
            titulo: 'LovePet - Animais',
            pagina: 'animais',
            animais: resultados
        });
    } catch (erro) {
        console.error('Erro ao buscar animais:', erro);
        return res.status(500).send('Erro ao carregar a lista de animais.');
    }
});

// ============================================
// CADASTRAR NOVO ANIMAL (Aba Contato)
// ============================================

app.get('/contato', (req, res) => {
    res.render('contato', {
        titulo: 'LovePet - Cadastrar Animal',
        pagina: 'contato',
        mensagem: null
    });
});

app.post('/contato', async (req, res) => {
    const { nome, tipo, raca, sexo, porte, vacinado, castrado, sociavel, breve_descricao } = req.body;
    const idResponsavel = null;


    try {
        const [resultadoAnimal] = await db.query(
            'INSERT INTO Animal (nome, tipo, raca, sexo, porte, id_abrigo, id_responsavel) VALUES (?, ?, ?, ?, ?, 1, ?)',
            [nome, tipo, raca || 'SRD', sexo, porte, idResponsavel]
        );

        const novoAnimalId = resultadoAnimal.insertId;

        await db.query(
            'INSERT INTO Saude (id_animal, vacinado, castrado, alergias, doencas, historico) VALUES (?, ?, ?, ?, ?, ?)',
            [novoAnimalId, vacinado === '1', castrado === '1', 'Nenhuma', 'Nenhuma', 'Cadastrado via sistema']
        );

        await db.query(
            'INSERT INTO Social (id_animal, sociavel, medos, breve_descricao) VALUES (?, ?, ?, ?)',
            [novoAnimalId, sociavel === '1', 'Nenhum', breve_descricao]
        );

        return res.redirect('/animais');
    } catch (erro) {
        console.error('Erro ao cadastrar animal:', erro);
        return res.status(500).send('Erro ao cadastrar animal no banco de dados.');
    }
});

// ============================================
// ROTAS DE CADASTRO E LOGIN (Tabela Responsavel)
// ============================================

app.get(['/cadastro', '/register'], (req, res) => {
    res.render('cadastro', { 
        titulo: 'LovePet - Cadastro', 
        pagina: 'cadastro',
        error: null 
    });
});

app.post(['/cadastro', '/register'], async (req, res) => {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
        return res.render('cadastro', {
            titulo: 'LovePet - Cadastro',
            pagina: 'cadastro',
            error: 'Preencha todos os campos obrigatórios.'
        });
    }

    try {
        // 1. Verifica se o e-mail já existe na tabela adotante
        const [adotantesExistentes] = await db.query(
            'SELECT adotante_id FROM adotante WHERE email = ?',
            [email]
        );

        if (adotantesExistentes.length > 0) {
            return res.render('cadastro', {
                titulo: 'LovePet - Cadastro',
                pagina: 'cadastro',
                error: 'Este e-mail já está cadastrado!'
            });
        }

        const senhaHash = await bcrypt.hash(senha, 10);
        // Gera um username curto automático (até 20 caracteres) baseado no e-mail
        const usernameAuto = email.split('@').substring(0, 20);

        // 2. Insere na tabela adotante respeitando todas as colunas
        const [resultado] = await db.query(
            `INSERT INTO adotante (nome, CPF, endereco, username, senha, telefone, email) 
             VALUES (?, '00000000000', 'Não informado', ?, ?, '0000000000', ?)`,
            [nome, usernameAuto, senhaHash, email]
        );

        req.session.usuario = {
            id: resultado.insertId,
            nome: nome,
            email: email
        };

        return res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro no cadastro:', erro);
        return res.render('cadastro', {
            titulo: 'LovePet - Cadastro',
            pagina: 'cadastro',
            error: 'Erro ao cadastrar: ' + erro.message
        });
    }
});

app.get(['/login', '/entrar'], (req, res) => {
    res.render('login', { 
        titulo: 'LovePet - Entrar', 
        pagina: 'login',
        error: null
    });
});

app.post(['/login', '/entrar'], async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.render('login', {
            titulo: 'LovePet - Entrar',
            pagina: 'login',
            error: 'Informe e-mail e senha.'
        });
    }

    try {
        const [adotantes] = await db.query(
            'SELECT * FROM adotante WHERE email = ?',
            [email]
        );

        if (adotantes.length === 0) {
            return res.render('login', {
                titulo: 'LovePet - Entrar',
                pagina: 'login',
                error: 'E-mail ou senha incorretos.'
            });
        }

        const adotante = adotantes;
        const senhaCorreta = await bcrypt.compare(senha, adotante.senha);

        if (!senhaCorreta) {
            return res.render('login', {
                titulo: 'LovePet - Entrar',
                pagina: 'login',
                error: 'E-mail ou senha incorretos.'
            });
        }

        req.session.usuario = {
            id: adotante.adotante_id,
            nome: adotante.nome,
            email: adotante.email
        };

        return res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro no login:', erro);
        return res.render('login', {
            titulo: 'LovePet - Entrar',
            pagina: 'login',
            error: 'Erro interno ao realizar login.'
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
});

// ============================================
// ROTAS DE SOLICITAÇÕES (Tabela Solicitacao)
// ============================================

// Listar solicitações e carregar animais disponíveis para o <select>
app.get('/solicitacoes', verificarAutenticacao, async (req, res) => {
    try {
        const sqlSolicitacoes = `
            SELECT s.*, a.nome AS nome_animal, a.tipo AS tipo_animal 
            FROM Solicitacao s 
            LEFT JOIN Animal a ON s.id_animal = a.animal_id 
            ORDER BY s.solicitacao_id DESC
        `;
        const [solicitacoes] = await db.query(sqlSolicitacoes);

        // Busca apenas os animais que ainda estão disponíveis
        const [animaisDisponiveis] = await db.query(
            'SELECT animal_id, nome, tipo FROM Animal WHERE disponivel = TRUE ORDER BY nome ASC'
        );

        res.render('solicitacoes', {
            titulo: 'LovePet - Solicitações',
            pagina: 'solicitacoes',
            solicitacoes: solicitacoes,
            animaisDisponiveis: animaisDisponiveis
        });
    } catch (erro) {
        console.error('Erro ao buscar solicitações:', erro);
        return res.status(500).send('Erro ao carregar solicitações.');
    }
});

// Criar nova solicitação e tornar o animal INDISPONÍVEL
app.post('/solicitacoes', verificarAutenticacao, async (req, res) => {
    const { animal_id, nome_interessado, telefone, mensagem } = req.body;

    if (!animal_id || !nome_interessado || !telefone) {
        return res.status(400).send('Selecione um animal e preencha nome e telefone.');
    }

    try {
        // 1. Registra a solicitação
        await db.query(
            'INSERT INTO Solicitacao (id_animal, nome_interessado, telefone, mensagem) VALUES (?, ?, ?, ?)',
            [animal_id, nome_interessado, telefone, mensagem || '']
        );

        // 2. Torna o animal indisponível na tabela Animal
        await db.query(
            'UPDATE Animal SET disponivel = FALSE WHERE animal_id = ?',
            [animal_id]
        );

        return res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro ao salvar solicitação:', erro);
        return res.status(500).send('Erro ao enviar solicitação.');
    }
});

// ============================================
// ROTAS DE SOLICITAÇÕES (Tabela Solicitacao)
// ============================================

// Listar solicitações e carregar animais disponíveis para o <select>
app.get('/solicitacoes', verificarAutenticacao, async (req, res) => {
    try {
        const sqlSolicitacoes = `
            SELECT s.*, a.nome AS nome_animal, a.tipo AS tipo_animal 
            FROM Solicitacao s 
            LEFT JOIN Animal a ON s.id_animal = a.animal_id 
            ORDER BY s.solicitacao_id DESC
        `;
        const [solicitacoes] = await db.query(sqlSolicitacoes);

        const [animaisDisponiveis] = await db.query(
            'SELECT animal_id, nome, tipo FROM Animal WHERE disponivel = TRUE ORDER BY nome ASC'
        );

        res.render('solicitacoes', {
            titulo: 'LovePet - Solicitações',
            pagina: 'solicitacoes',
            solicitacoes: solicitacoes,
            animaisDisponiveis: animaisDisponiveis
        });
    } catch (erro) {
        console.error('Erro ao buscar solicitações:', erro);
        return res.status(500).send('Erro ao carregar solicitações.');
    }
});

// Criar nova solicitação e tornar o animal INDISPONÍVEL
app.post('/solicitacoes', verificarAutenticacao, async (req, res) => {
    const { animal_id, nome_interessado, telefone, mensagem } = req.body;

    if (!animal_id || !nome_interessado || !telefone) {
        return res.status(400).send('Selecione um animal e preencha nome e telefone.');
    }

    try {
        await db.query(
            'INSERT INTO Solicitacao (id_animal, nome_interessado, telefone, mensagem) VALUES (?, ?, ?, ?)',
            [animal_id, nome_interessado, telefone, mensagem || '']
        );

        await db.query(
            'UPDATE Animal SET disponivel = FALSE WHERE animal_id = ?',
            [animal_id]
        );

        return res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro ao salvar solicitação:', erro);
        return res.status(500).send('Erro ao enviar solicitação.');
    }
});

// Atualizar status da solicitação (Se recusada, libera o animal novamente)
app.post('/solicitacoes/atualizar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    try {
        await db.query('UPDATE Solicitacao SET status = ? WHERE solicitacao_id = ?', [status, id]);

        if (status === 'Recusada') {
            const [sol] = await db.query('SELECT id_animal FROM Solicitacao WHERE solicitacao_id = ?', [id]);
            if (sol.length > 0 && sol[0].id_animal) {
                await db.query('UPDATE Animal SET disponivel = TRUE WHERE animal_id = ?', [sol[0].id_animal]);
            }
        }

        return res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro ao atualizar solicitação:', erro);
        return res.status(500).send('Erro ao atualizar solicitação.');
    }
});

// Excluir solicitação (e liberar o animal novamente)
app.post('/solicitacoes/deletar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;

    try {
        const [sol] = await db.query('SELECT id_animal FROM Solicitacao WHERE solicitacao_id = ?', [id]);
        if (sol.length > 0 && sol[0].id_animal) {
            await db.query('UPDATE Animal SET disponivel = TRUE WHERE animal_id = ?', [sol[0].id_animal]);
        }

        await db.query('DELETE FROM Solicitacao WHERE solicitacao_id = ?', [id]);
        return res.redirect('/solicitacoes');
    } catch (erro) {
        console.error('Erro ao excluir solicitação:', erro);
        return res.status(500).send('Erro ao excluir solicitação.');
    }
});

// ============================================
// INICIALIZAÇÃO DO SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em: http://localhost:${PORT}`);
});