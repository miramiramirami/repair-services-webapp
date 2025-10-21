const http = require('http')
const path = require('path')
const staticFile = require('./utils/staticFile')
const {
	handleRegister,
	handleLogin,
	handleLogout,
	getProfile,
	changeInfo,
} = require('./controllers/authController')
const { requireAuth, adminAuth } = require('./utils/middlewareAuth')
const {
	createOrder,
	getUserOrders,
	getAllOrders,
	updateOrderStatus,
	getServices,
	getUserChats,
	getChatMessages,
	sendMessage,
	getChatInfo,
	markMessagesAsRead,
} = require('./controllers/orderController')
const {
	createService,
	getAdminServices,
	toggleService,
	deleteService,
} = require('./controllers/serviceController')
const { initWebSocket } = require('./utils/websocket')

const PORT = 8000
const mimeTypes = require('./utils/types')

const server = http.createServer(async (req, res) => {
	let urlPath = req.url
	urlPath = urlPath.split('?')[0]
	const method = req.method

	console.log(`Метод: ${method} URL: ${urlPath}`)

	try {
		if (urlPath.startsWith('/css/')) {
			const actualPath = urlPath.replace('/css/', '/styles/')
			return staticFile(res, actualPath, '.css')
		}

		if (urlPath.startsWith('/js/')) {
			return staticFile(res, urlPath, '.js')
		}

		if (urlPath.startsWith('/images/')) {
			const ext = path.extname(urlPath)
			return staticFile(res, urlPath, ext)
		}

		if (urlPath.startsWith('/uploads/')) {
			const ext = path.extname(urlPath)
			return staticFile(res, urlPath, ext)
		}

		if (urlPath === '/register' && method === 'POST') {
			return await handleRegister(req, res)
		}

		if (urlPath === '/login' && method === 'POST') {
			return await handleLogin(req, res)
		}

		if (urlPath === '/logout') {
			if (method === 'POST') {
				return await handleLogout(req, res)
			}
		}

		if (urlPath === '/api/services' && method === 'GET') {
			return await getServices(req, res)
		}

		if (urlPath === '/api/orders' && method === 'POST') {
			return await createOrder(req, res)
		}

		if (urlPath === '/api/orders' && method === 'GET') {
			return await getUserOrders(req, res)
		}

		if (urlPath === '/api/admin/orders' && method === 'GET') {
			return adminAuth(req, res, async () => {
				await getAllOrders(req, res)
			})
		}

		if (urlPath === '/admin' && method === 'GET') {
			return adminAuth(req, res, async () => {
				if (req.user.role !== 'admin') {
					res.writeHead(302, { Location: '/profile' })
					return res.end()
				}
				staticFile(res, '/html/admin.html', '.html')
			})
		}

		if (urlPath === '/api/admin/orders/status' && method === 'PUT') {
			return adminAuth(req, res, async () => {
				await updateOrderStatus(req, res)
			})
		}

		if (urlPath === '/api/admin/services' && method === 'POST') {
			return adminAuth(req, res, async () => {
				await createService(req, res)
			})
		}

		if (urlPath === '/api/admin/services' && method === 'GET') {
			return adminAuth(req, res, async () => {
				await getAdminServices(req, res)
			})
		}

		if (
			urlPath.match(/^\/api\/admin\/services\/\d+\/toggle$/) &&
			method === 'POST'
		) {
			return adminAuth(req, res, async () => {
				const serviceId = req.url.split('/')[4]
				await toggleService(req, res, serviceId)
			})
		}

		if (urlPath.match(/^\/api\/admin\/services\/\d+$/) && method === 'DELETE') {
			return adminAuth(req, res, async () => {
				const serviceId = req.url.split('/')[4]
				await deleteService(req, res, serviceId)
			})
		}

		if (urlPath === '/api/profile' && method === 'GET') {
			return requireAuth(req, res, () => getProfile(req, res))
		}

		if (urlPath === '/profile') {
			return requireAuth(req, res, async () => {
				staticFile(res, '/html/profile.html', '.html')
			})
		}

		if (urlPath === '/api/profile' && method === 'PUT') {
			return requireAuth(req, res, () => {
				changeInfo(req, res)
			})
		}

		if (urlPath === '/api/chats' && method === 'GET') {
			return requireAuth(req, res, () => getUserChats(req, res))
		}

		if (urlPath === '/chat' && method === 'GET') {
			return requireAuth(req, res, async () => {
				staticFile(res, '/html/chat.html', '.html')
			})
		}

		if (urlPath === '/api/chats/messages' && method === 'GET') {
			return requireAuth(req, res, async () => {
				await getChatMessages(req, res)
			})
		}

		if (urlPath === '/api/chats/mark-read' && method === 'POST') {
			return requireAuth(req, res, async () => {
				await markMessagesAsRead(req, res)
			})
		}

		if (urlPath === '/api/chats/messages' && method === 'POST') {
			return requireAuth(req, res, async () => {
				await sendMessage(req, res)
			})
		}

		if (urlPath === '/api/chats/info' && method === 'GET') {
			return requireAuth(req, res, async () => {
				await getChatInfo(req, res)
			})
		}

		if (urlPath === '/services') {
			return staticFile(res, '/html/services.html', '.html')
		}

		if (urlPath === '/create-order' && method === 'GET') {
			return requireAuth(req, res, async () => {
				staticFile(res, '/html/create-order.html', '.html')
			})
		}

		switch (urlPath) {
			case '/':
				console.log('main page')
				staticFile(res, '/html/index.html', '.html')
				break

			case '/login':
				if (method === 'GET') {
					staticFile(res, '/html/login.html', '.html')
				}
				break

			case '/register':
				if (method === 'GET') {
					staticFile(res, '/html/register.html', '.html')
				}
				break
			case '/page2':
				staticFile(res, '/html/page2.html', '.html')
				break

			default:
				const extname = String(path.extname(urlPath)).toLowerCase()
				if (extname in mimeTypes) {
					staticFile(res, urlPath, extname)
				} else {
					res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
					res.end('<h1>404 - Page Not Found</h1>')
				}
		}
	} catch (error) {
		console.error('Ошибка сервера:', error)
		res.writeHead(500, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Internal server error' }))
	}
})

initWebSocket(server)

server.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`)
})
