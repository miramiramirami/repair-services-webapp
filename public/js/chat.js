let currentChatId = null
let currentUser = null
let ws = null

document.addEventListener('DOMContentLoaded', function () {
	initWebSocket()
	loadUserInfo()

	const urlParams = new URLSearchParams(window.location.search)
	currentChatId = urlParams.get('id')

	if (!currentChatId) {
		window.location.href = '/profile'
		return
	}

	loadChatInfo()
	loadMessages()
	setupEventListeners()
})

function initWebSocket() {
	if (ws) return

	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	const wsUrl = `${protocol}//${window.location.host}`

	ws = new WebSocket(wsUrl)

	ws.onmessage = event => {
		const data = JSON.parse(event.data)

		if (data.type === 'new_message' && data.chatId == currentChatId) {
			if (data.message.sender_id === currentUser.id) {
				data.message.sender_name = 'Вы'
				data.message.sender_role = currentUser.role
			}
			displayMessage(data.message)
			scrollToBottom()
		}
	}

	ws.onerror = err => {
		console.error('Ошибка WebSocket:', err)
	}

	ws.onclose = () => {
		console.log('WebSocket disconnected')
	}
}

async function loadUserInfo() {
	try {
		const response = await fetch('/api/profile')
		const data = await response.json()

		if (data.success) {
			currentUser = data.user
			console.log('Current user loaded:', currentUser)
		}
	} catch (error) {
		console.error('Ошибка загрузки информации о пользователе:', error)
	}
}

async function loadChatInfo() {
	try {
		const response = await fetch(`/api/chats/info?chatId=${currentChatId}`)
		const data = await response.json()

		const profileResponse = await fetch('/api/profile')
		userData = await profileResponse.json()

		if (userData.success) {
			user = userData.user
		} else {
			alert('Ошибка загрузки профиля')
		}

		if (data.success) {
			document.getElementById(
				'chatTitle'
			).innerHTML = `<a style='text-decoration: none; color: white' href='/profile'>←</a> <span style='color: rgba(255, 255, 255, 0.65);'>Чат по заявке</span> <span style='color: white; font-size: 18px'>${
				'«' + data.chat.service_name + '»'
			} <span style='font-size: 24px; margin-left: 6rem; ${
				user.role === 'admin' ? 'border-left: 1px solid white;' : ''
			}  padding: 1rem'>${
				user.role === 'admin' ? data.chat.user_name : ''
			}</span></div>`
		} else {
			alert('Ошибка загрузки информации о чате')
			window.location.href = '/profile'
		}
	} catch (error) {
		console.error('Ошибка загрузки информации о чате:', error)
	}
}

async function loadMessages() {
	try {
		const response = await fetch(`/api/chats/messages?chatId=${currentChatId}`)
		const data = await response.json()

		const container = document.getElementById('messagesContainer')

		if (data.success) {
			container.innerHTML = ''
			data.messages.forEach(message => {
				if (message.sender_id === currentUser.id) {
					message.sender_name = 'Вы'
				}
				displayMessage(message)
			})
			scrollToBottom()
		} else {
			container.innerHTML = '<div class="error">Ошибка загрузки сообщений</div>'
		}
	} catch (error) {
		console.error('Ошибка загрузки сообщений:', error)
		document.getElementById('messagesContainer').innerHTML =
			'<div class="error">Ошибка загрузки сообщений</div>'
	}
}

function displayMessage(message) {
	const container = document.getElementById('messagesContainer')
	const isOwnMessage = message.sender_id === currentUser.id

	const messageElement = document.createElement('div')
	messageElement.className = `message ${isOwnMessage ? 'own' : 'other'}`
	messageElement.innerHTML = `
        <div class="message-text">${escapeHtml(message.message)}</div>
        <div class="message-info">
            ${message.sender_name || 'Неизвестный'} • 
            ${new Date(message.created_at).toLocaleString()}
        </div>
    `

	container.appendChild(messageElement)
}

function setupEventListeners() {
	const form = document.getElementById('messageForm')
	const input = document.getElementById('messageInput')

	form.addEventListener('submit', async e => {
		e.preventDefault()

		const message = input.value.trim()
		if (!message) return

		await sendMessage(message)
		input.value = ''
	})
}

async function sendMessage(messageText) {
	try {
		const tempMessage = {
			id: 'temp-' + Date.now(),
			sender_id: currentUser.id,
			sender_name: 'Вы',
			sender_role: currentUser.role,
			message: messageText,
			created_at: new Date().toISOString(),
		}
		displayMessage(tempMessage)
		scrollToBottom()

		const formData = new URLSearchParams()
		formData.append('chat_id', currentChatId)
		formData.append('message', messageText)

		const response = await fetch('/api/chats/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: formData,
		})

		const data = await response.json()

		if (data.success) {
			const messages = document.querySelectorAll('.message')
			const lastMessage = messages[messages.length - 1]
			if (
				lastMessage &&
				lastMessage.querySelector('.message-text').textContent === messageText
			) {
				lastMessage.remove()
			}
		} else {
			alert('Ошибка отправки сообщения: ' + data.error)
			const messages = document.querySelectorAll('.message')
			const lastMessage = messages[messages.length - 1]
			if (
				lastMessage &&
				lastMessage.querySelector('.message-text').textContent === messageText
			) {
				lastMessage.remove()
			}
		}
	} catch (error) {
		console.error('Ошибка отправки сообщения:', error)
		alert('Ошибка отправки сообщения')
		const messages = document.querySelectorAll('.message')
		const lastMessage = messages[messages.length - 1]
		if (
			lastMessage &&
			lastMessage.querySelector('.message-text').textContent === messageText
		) {
			lastMessage.remove()
		}
	}
}

function scrollToBottom() {
	const container = document.getElementById('messagesContainer')
	container.scrollTop = container.scrollHeight
}

function escapeHtml(unsafe) {
	return unsafe
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;')
}
