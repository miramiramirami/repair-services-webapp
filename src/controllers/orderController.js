const db = require('../utils/database')
const querystring = require('querystring')
const { requireAuth } = require('../utils/middlewareAuth')
const { sendToUser } = require('../utils/websocket')

function getBody(req) {
	return new Promise(resolve => {
		let body = ''
		req.on('data', chunk => (body += chunk))
		req.on('end', () => resolve(JSON.parse(body)))
	})
}

async function createOrder(req, res) {
	await requireAuth(req, res, async () => {
		let body = ''

		req.on('data', chunk => {
			body += chunk.toString()
		})

		req.on('end', async () => {
			try {
				const formData = querystring.parse(body)
				const { service_id, user_phone, user_address, description } = formData

				if (!service_id || !user_phone || !user_address) {
					res.writeHead(400, { 'Content-Type': 'application/json' })
					res.end(JSON.stringify({ error: 'Все поля обязательны' }))
					return
				}

				const result = await db(
					'INSERT INTO orders (user_id, service_id, user_phone, user_address, description) VALUES (?, ?, ?, ?, ?)',
					[
						req.user.id,
						service_id,
						user_phone,
						user_address,
						description.trim(),
					]
				)

				res.writeHead(201, { 'Content-Type': 'application/json' })
				res.end(
					JSON.stringify({
						success: true,
						message: 'Заявка создана',
						order_id: result.insertId,
					})
				)
			} catch (error) {
				console.error('Ошибка создания заявки:', error)
				res.writeHead(500, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({ error: 'Ошибка создания заявки' }))
			}
		})
	})
}

async function getUserOrders(req, res) {
	await requireAuth(req, res, async () => {
		try {
			const orders = await db(
				`
                SELECT o.*, s.name as service_name, s.price,
                       c.id as chat_id
                FROM orders o
                JOIN services s ON o.service_id = s.id
                LEFT JOIN chats c ON o.id = c.order_id
                WHERE o.user_id = ?
                ORDER BY o.created_at DESC
            `,
				[req.user.id]
			)

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, orders }))
		} catch (error) {
			console.error('Ошибка получения заявок:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка получения заявок' }))
		}
	})
}

async function getAllOrders(req, res) {
	await requireAuth(req, res, async () => {
		if (req.user.role !== 'admin') {
			res.writeHead(403, { 'Content-Type': 'application/json' })
			return res.end(JSON.stringify({ error: 'Доступ запрещен' }))
		}

		try {
			const orders = await db(`
                SELECT o.*, u.name as user_name, u.email, s.name as service_name
                FROM orders o
                JOIN users u ON o.user_id = u.id
                JOIN services s ON o.service_id = s.id
                ORDER BY o.created_at DESC
            `)

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, orders }))
		} catch (error) {
			console.error('Ошибка получения заявок:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка получения заявок' }))
		}
	})
}

async function updateOrderStatus(req, res) {
	let body = ''
	req.on('data', chunk => (body += chunk))
	req.on('end', async () => {
		try {
			const formData = querystring.parse(body)
			const { order_id, status, admin_notes } = formData

			const [order] = await db('SELECT user_id FROM orders WHERE id = ?', [
				order_id,
			])
			if (!order) {
				return res
					.writeHead(404)
					.end(JSON.stringify({ error: 'Заказ не найден' }))
			}

			const user_id = order.user_id
			const admin_id = req.user.id

			await db(
				'UPDATE orders SET status = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?',
				[status, admin_notes || null, order_id]
			)

			if (status === 'in_progress') {
				const [existingChat] = await db(
					'SELECT id FROM chats WHERE order_id = ?',
					[order_id]
				)

				let chat_id
				if (existingChat) {
					chat_id = existingChat.id
				} else {
					const result = await db(
						'INSERT INTO chats (order_id, user_id, admin_id) VALUES (?, ?, ?)',
						[order_id, user_id, admin_id]
					)
					chat_id = result.insertId
				}

				if (admin_notes) {
					const msgResult = await db(
						'INSERT INTO messages (chat_id, sender_id, message) VALUES (?, ?, ?)',
						[chat_id, admin_id, admin_notes]
					)

					sendToUser(user_id, {
						type: 'new_message',
						chatId: chat_id,
						message: {
							id: msgResult.insertId,
							sender_id: admin_id,
							message: admin_notes,
							created_at: new Date().toISOString(),
						},
					})
				}
			}

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, message: 'Статус обновлен' }))
		} catch (error) {
			console.error('Ошибка обновления статуса:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка обновления статуса' }))
		}
	})
}

async function getServices(req, res) {
	try {
		const services = await db('SELECT * FROM services WHERE is_active = true')
		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ success: true, services }))
	} catch (error) {
		console.error('Ошибка получения услуг:', error)
		res.writeHead(500, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Ошибка получения услуг' }))
	}
}

async function getUserChats(req, res) {
	await requireAuth(req, res, async () => {
		try {
			const userId = req.user.id
			const userRole = req.user.role

			let query, params

			if (userRole === 'admin') {
				query = `
                    SELECT 
                        c.id AS chat_id,
                        c.order_id,
                        s.name AS service_name,
                        o.created_at AS order_date,
                        u.name AS user_name,
                        m.message AS last_message,
                        m.created_at AS last_message_time,
                        (SELECT COUNT(*) FROM messages 
                         WHERE chat_id = c.id 
                         AND sender_id != ? 
                         AND is_read = FALSE) as unread_count
                    FROM chats c
                    JOIN orders o ON c.order_id = o.id
                    JOIN services s ON o.service_id = s.id
                    JOIN users u ON c.user_id = u.id
                    LEFT JOIN (
                        SELECT chat_id, message, created_at,
                            ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
                        FROM messages
                    ) m ON c.id = m.chat_id AND m.rn = 1
                    WHERE c.admin_id = ?
                    ORDER BY c.created_at DESC`
				params = [userId, userId]
			} else {
				query = `
                    SELECT 
                        c.id AS chat_id,
                        c.order_id,
                        s.name AS service_name,
                        o.created_at AS order_date,
                        m.message AS last_message,
                        m.created_at AS last_message_time,
                        (SELECT COUNT(*) FROM messages 
                         WHERE chat_id = c.id 
                         AND sender_id != ? 
                         AND is_read = FALSE) as unread_count
                    FROM chats c
                    JOIN orders o ON c.order_id = o.id
                    JOIN services s ON o.service_id = s.id
                    LEFT JOIN (
                        SELECT chat_id, message, created_at,
                            ROW_NUMBER() OVER (PARTITION BY chat_id ORDER BY created_at DESC) as rn
                        FROM messages
                    ) m ON c.id = m.chat_id AND m.rn = 1
                    WHERE c.user_id = ?
                    ORDER BY c.created_at DESC`
				params = [userId, userId]
			}

			const chats = await db(query, params)

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, chats }))
		} catch (error) {
			console.error('Ошибка загрузки чатов:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка сервера' }))
		}
	})
}

async function getChatMessages(req, res) {
	await requireAuth(req, res, async () => {
		try {
			const url = new URL(req.url, `http://${req.headers.host}`)
			const chatId = url.searchParams.get('chatId')

			if (!chatId) {
				res.writeHead(400, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'ID чата обязателен' }))
			}

			const [chat] = await db(
				'SELECT * FROM chats WHERE id = ? AND (user_id = ? OR admin_id = ?)',
				[chatId, req.user.id, req.user.id]
			)

			if (!chat) {
				res.writeHead(403, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'Доступ запрещен' }))
			}

			const messages = await db(
				`SELECT m.*, u.name as sender_name, u.role as sender_role
                 FROM messages m
                 JOIN users u ON m.sender_id = u.id
                 WHERE m.chat_id = ?
                 ORDER BY m.created_at ASC`,
				[chatId]
			)

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, messages }))
		} catch (error) {
			console.error('Ошибка получения сообщений:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка получения сообщений' }))
		}
	})
}

async function sendMessage(req, res) {
	await requireAuth(req, res, async () => {
		let body = ''

		req.on('data', chunk => {
			body += chunk.toString()
		})

		req.on('end', async () => {
			try {
				const formData = querystring.parse(body)
				const { chat_id, message } = formData

				if (!chat_id || !message) {
					res.writeHead(400, { 'Content-Type': 'application/json' })
					return res.end(JSON.stringify({ error: 'Все поля обязательны' }))
				}

				const [chat] = await db(
					'SELECT * FROM chats WHERE id = ? AND (user_id = ? OR admin_id = ?)',
					[chat_id, req.user.id, req.user.id]
				)

				if (!chat) {
					res.writeHead(403, { 'Content-Type': 'application/json' })
					return res.end(JSON.stringify({ error: 'Доступ запрещен' }))
				}

				const result = await db(
					'INSERT INTO messages (chat_id, sender_id, message) VALUES (?, ?, ?)',
					[chat_id, req.user.id, message.trim()]
				)

				const [newMessage] = await db(
					`SELECT m.*, u.name as sender_name, u.role as sender_role
                     FROM messages m
                     JOIN users u ON m.sender_id = u.id
                     WHERE m.id = ?`,
					[result.insertId]
				)

				const receiverId =
					req.user.id === chat.user_id ? chat.admin_id : chat.user_id

				sendToUser(receiverId, {
					type: 'new_message',
					chatId: chat_id,
					message: newMessage,
				})

				sendToUser(req.user.id, {
					type: 'new_message',
					chatId: chat_id,
					message: newMessage,
				})

				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(
					JSON.stringify({
						success: true,
						message: 'Сообщение отправлено',
						message_id: result.insertId,
					})
				)
			} catch (error) {
				console.error('Ошибка отправки сообщения:', error)
				res.writeHead(500, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({ error: 'Ошибка отправки сообщения' }))
			}
		})
	})
}

async function getChatInfo(req, res) {
	await requireAuth(req, res, async () => {
		try {
			const url = new URL(req.url, `http://${req.headers.host}`)
			const chatId = url.searchParams.get('chatId')

			if (!chatId) {
				res.writeHead(400, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'ID чата обязателен' }))
			}

			const [chat] = await db(
				`SELECT c.*, o.service_id, s.name as service_name, 
                        u.name as user_name, a.name as admin_name
                 FROM chats c
                 JOIN orders o ON c.order_id = o.id
                 JOIN services s ON o.service_id = s.id
                 JOIN users u ON c.user_id = u.id
                 JOIN users a ON c.admin_id = a.id
                 WHERE c.id = ? AND (c.user_id = ? OR c.admin_id = ?)`,
				[chatId, req.user.id, req.user.id]
			)

			if (!chat) {
				res.writeHead(403, { 'Content-Type': 'application/json' })
				return res.end(JSON.stringify({ error: 'Доступ запрещен' }))
			}

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, chat }))
		} catch (error) {
			console.error('Ошибка получения информации о чате:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка получения информации о чате' }))
		}
	})
}

async function markMessagesAsRead(req, res) {
	await requireAuth(req, res, async () => {
		let body = ''

		req.on('data', chunk => {
			body += chunk.toString()
		})

		req.on('end', async () => {
			try {
				const formData = JSON.parse(body)
				const chatId = formData.chatId

				if (!chatId) {
					res.writeHead(400, { 'Content-Type': 'application/json' })
					return res.end(JSON.stringify({ error: 'ID чата обязателен' }))
				}

				const [chat] = await db(
					'SELECT * FROM chats WHERE id = ? AND (user_id = ? OR admin_id = ?)',
					[chatId, req.user.id, req.user.id]
				)

				if (!chat) {
					res.writeHead(403, { 'Content-Type': 'application/json' })
					return res.end(JSON.stringify({ error: 'Доступ запрещен' }))
				}

				const result = await db(
					'UPDATE messages SET is_read = TRUE WHERE chat_id = ? AND sender_id != ? AND is_read = FALSE',
					[chatId, req.user.id]
				)

				res.writeHead(200, { 'Content-Type': 'application/json' })
				res.end(
					JSON.stringify({
						success: true,
						updated: result.affectedRows,
					})
				)
			} catch (error) {
				console.error('Ошибка отметки сообщений как прочитанных:', error)
				res.writeHead(500, { 'Content-Type': 'application/json' })
				res.end(JSON.stringify({ error: 'Ошибка сервера' }))
			}
		})
	})
}

module.exports = {
	createOrder,
	getUserOrders,
	getAllOrders,
	updateOrderStatus,
	getServices,
	getUserChats,
	getChatInfo,
	sendMessage,
	getChatMessages,
	markMessagesAsRead,
}
