const mysql = require('mysql2');
require('dotenv').config();

// Criar um Pool de conexões (mais estável para bancos na nuvem como o Aiven)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Testar a conexão inicial
pool.getConnection((erro, connection) => {
    if (erro) {
        console.error('❌ Erro ao conectar no MySQL:', erro.message);
        return;
    }
    console.log('✅ Conectado ao MySQL com sucesso!');
    connection.release();
});

// Exportar com .promise() para funcionar com async/await no app.js
module.exports = pool.promise();