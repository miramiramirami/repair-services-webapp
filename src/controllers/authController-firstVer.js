const querystring = require('querystring')
const db = require('../utils/database')
const crypto = require('crypto')

function generationToken() {
	return crypto.randomBytes(32).toString('hex')
}

async function handleRegister(req, res) {
	let body = ''

	req.on('data', chunk => {
		body += chunk.toString()
	})

	req.on('end', async () => {
		try {
			const formData = querystring.parse(body)
			const { name, email, password } = formData

			console.log('Регистрация:', { name, email })

			const hashedPassword = crypto
				.createHash('sha256')
				.update(password)
				.digest('hex')

			const result = await db(
				'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
				[name, email, hashedPassword]
			)

			const sessionToken = generationToken()
			await db(`UPDATE users SET session_token = ? WHERE id = ?`, [
				sessionToken,
				result.insertId,
			])

			res.setHeader(
				'Set-Cookie',
				`session=${sessionToken}; HttpOnly; Max-Age=${86400 * 30}; Path=/`
			)
			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, message: 'Пользователь создан' }))
		} catch (error) {
			console.error('Ошибка регистрации:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка регистрации' }))
		}
	})
}

async function handleLogin(req, res) {
	let body = ''
	req.on('data', chunk => {
		body += chunk.toString()
	})

	req.on('end', async () => {
		try {
			const formData = querystring.parse(body)
			const { email, password } = formData

			const hashedPassword = crypto
				.createHash('sha256')
				.update(password)
				.digest('hex')

			const users = await db(
				'SELECT * FROM users WHERE email = ? AND password = ?',
				[email, hashedPassword]
			)

			if (users.length === 0) {
				res.writeHead(401, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'Неверный email или пароль' }))
			}

			const user = users[0]
			const sessionToken = generationToken()

			console.log('User при логине:', user)

			await db(
				'UPDATE users SET session_token = ?, token_expires = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id = ?',
				[sessionToken, user.id]
			)
			console.log('Обновляем сессию для user.id:', user.id)
			console.log('Новый токен:', sessionToken)
			console.log(
				'Токен будет действителен до:',
				new Date(Date.now() + 24 * 60 * 60 * 1000)
			)
			res.setHeader(
				'Set-Cookie',
				`session=${sessionToken}; HttpOnly; Max-Age=${86400 * 30}; Path=/`
			)
			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(
				JSON.stringify({
					success: true,
					message: 'Вход выполнен',
					user: { name: user.name, email: user.email },
				})
			)
		} catch (error) {
			console.error('Ошибка входа:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка входа' }))
		}
	})
}

async function handleLogout(req, res) {
	const cookies = parseCookies(req)
	const sessionToken = cookies.session

	if (sessionToken) {
		await db('UPDATE users SET session_token = NULL WHERE session_token = ?', [
			sessionToken,
		])
	}

	res.setHeader('Set-Cookie', 'session=; HttpOnly; Max-Age=0; Path=/')
	res.writeHead(200, { 'Content-Type': 'application/json' })
	res.end(JSON.stringify({ success: true, message: 'Выход выполнен' }))
}

function parseCookies(req) {
	const cookieHeader = req.headers.cookie
	if (!cookieHeader) return {}

	return cookieHeader.split(';').reduce((cookies, cookie) => {
		const [name, value] = cookie.trim().split('=')
		cookies[name] = value
		return cookies
	}, {})
}

module.exports = {
	handleRegister,
	handleLogin,
	handleLogout,
	parseCookies,
}
