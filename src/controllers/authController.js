const querystring = require('querystring')
const db = require('../utils/database')
const crypto = require('crypto')
const bcrypt = require('bcrypt')

const SALT_ROUNDS = 12
const SESSION_TIMEOUT = 24 * 60

function generationToken() {
	return crypto.randomBytes(32).toString('hex')
}

function validateRegistrationData(name, phone, email, password) {
	const errors = []

	if (!name || name.length < 2 || name.length > 50) {
		errors.push('Имя должно быть от 2 до 50 символов')
	}

	if (!phone || phone.length < 11) {
		errors.push('Телефон должен быть мобильным и содержать 11 или более знаков')
	}

	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		errors.push('Некорректный ßemail')
	}

	if (!password || password.length < 8) {
		errors.push('Пароль должен быть не менее 8 символов')
	}

	return errors
}

async function handleRegister(req, res) {
	let body = ''

	req.on('data', chunk => {
		body += chunk.toString()
	})

	req.on('end', async () => {
		try {
			const formData = querystring.parse(body)
			const { name, phone, email, password } = formData

			const errors = validateRegistrationData(name, phone, email, password)
			if (errors.length > 0) {
				res.writeHead(400, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: errors.join(', ') }))
			}

			const existingUsers = await db('SELECT id FROM users WHERE email = ?', [
				email,
			])

			if (existingUsers.length > 0) {
				res.writeHead(409, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'Пользователь уже существует' }))
			}

			const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

			const result = await db(
				'INSERT INTO users (name, phone, email, password) VALUES (?, ?, ?, ?)',
				[name.trim(), phone.trim(), email.toLowerCase().trim(), hashedPassword]
			)

			const sessionToken = generationToken()
			await db(
				'UPDATE users SET session_token = ?, token_expires = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id = ?',
				[sessionToken, result.insertId]
			)

			res.setHeader(
				'Set-Cookie',
				`session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TIMEOUT}; Path=/`
			)
			res.writeHead(302, { Location: '/services' })
			res.end()
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

			const users = await db('SELECT * FROM users WHERE email = ?', [
				email.toLowerCase().trim(),
			])

			if (users.length === 0) {
				res.writeHead(401, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'Неверный email или пароль' }))
			}

			const user = users[0]
			const isPasswordValid = await bcrypt.compare(password, user.password)

			if (!isPasswordValid) {
				res.writeHead(401, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'Неверный email или пароль' }))
			}

			const sessionToken = generationToken()
			await db(
				'UPDATE users SET session_token = ?, token_expires = DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id = ?',
				[sessionToken, user.id]
			)

			res.setHeader(
				'Set-Cookie',
				`session=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TIMEOUT}; Path=/`
			)
			res.writeHead(302, { Location: '/profile' })
			res.end()
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

async function getProfile(req, res) {
	try {
		if (!req.user) {
			res.writeHead(401, { 'Content-Type': 'application/json' })
			return res.end(JSON.stringify({ error: 'Пользователь не найден' }))
		}

		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(
			JSON.stringify({
				success: true,
				user: {
					id: req.user.id,
					name: req.user.name,
					phone: req.user.phone,
					email: req.user.email,
					role: req.user.role || 'user',
				},
			})
		)
	} catch (error) {
		console.error('Ошибка получения профиля:', error)
		res.writeHead(500, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Ошибка получения профиля' }))
	}
}

async function changeInfo(req, res) {
	let body = ''
	req.on('data', chunk => {
		body += chunk.toString()
	})
	req.on('end', async () => {
		try {
			const { name, email, phone } = JSON.parse(body)

			if (!name || !email) {
				res.writeHead(400, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'Имя и email обязательны' }))
			}

			await db('UPDATE users SET name = ?, email = ?, phone = ? WHERE id = ?', [
				name,
				email,
				phone,
				req.user.id,
			])

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, message: 'Профиль обновлён' }))
		} catch (error) {
			console.error('Ошибка обновления профиля:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка сервера' }))
		}
	})
}

module.exports = {
	handleRegister,
	handleLogin,
	handleLogout,
	parseCookies,
	getProfile,
	changeInfo,
}
