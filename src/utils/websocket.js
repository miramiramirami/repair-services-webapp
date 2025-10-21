const WebSocket = require('ws')
const db = require('./database')
const { parseCookies } = require('../controllers/authController')

const clients = new Map()

let wss = null

function initWebSocket(server) {
	wss = new WebSocket.Server({ server })

	wss.on('connection', (ws, req) => {
		const cookies = parseCookies(req)
		const sessionToken = cookies.session

		if (!sessionToken) {
			ws.close(4001, 'Нет авторизации')
			return
		}

		db(
			`SELECT id FROM users WHERE session_token = ? AND token_expires > NOW()`,
			[sessionToken]
		)
			.then(users => {
				if (users.length === 0) {
					ws.close(4002, 'Недействительная сессия')
					return
				}

				const userId = users[0].id
				clients.set(userId, ws)

				ws.on('close', () => {
					clients.delete(userId)
				})

				ws.on('error', () => {
					clients.delete(userId)
				})
			})
			.catch(err => {
				console.error('Ошибка подключения WS:', err)
				ws.close(5000, 'Ошибка сервера')
			})
	})
}

function sendToUser(userId, data) {
	const ws = clients.get(userId)
	if (ws && ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data))
	}
}

module.exports = { initWebSocket, sendToUser }
