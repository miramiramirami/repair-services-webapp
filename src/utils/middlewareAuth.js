const db = require('./database')
const { parseCookies } = require('../controllers/authController')

async function requireAuth(req, res, next) {
	const cookies = parseCookies(req)
	const sessionToken = cookies.session

	if (!sessionToken) {
		res.writeHead(302, { Location: '/login' })
		return res.end()
	}

	try {
		const users = await db(
			`SELECT id, name, phone, email, role FROM users WHERE session_token=? AND token_expires > NOW()`,
			[sessionToken]
		)

		if (users.length === 0) {
			res.writeHead(401, { 'Content-Type': 'application/json' })
			return res.end(JSON.stringify({ error: 'Недействительная сессия' }))
		}

		req.user = users[0]
		next()
	} catch (error) {
		console.error('Ошибка проверки авторизации:', error)
		res.writeHead(500, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Ошибка сервера' }))
	}
}

function adminAuth(req, res, next) {
	requireAuth(req, res, () => {
		if (req.user.role !== 'admin') {
			res.writeHead(302, { Location: '/profile' })
			return res.end()
		}
		next()
	})
}

module.exports = { requireAuth, adminAuth }
