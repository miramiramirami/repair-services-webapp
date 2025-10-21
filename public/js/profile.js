let currentUser = null
let allOrders = []
let displayedCount = 0
let unreadCount = 0
let ws = null

function initWebSocket() {
	if (ws) return

	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
	const wsUrl = `${protocol}//${window.location.host}`

	ws = new WebSocket(wsUrl)

	ws.onmessage = event => {
		const data = JSON.parse(event.data)

		if (data.type === 'new_message') {
			updateUnreadCount()
			if (document.querySelector('#chats').classList.contains('active')) {
				loadChats()
			}
		}
	}

	ws.onerror = err => {
		console.error('Ошибка WebSocket:', err)
		ws.close()
	}
}

async function updateUnreadCount() {
	try {
		const response = await fetch('/api/chats')

		const data = await response.json()

		if (data.success) {
			let totalUnread = 0
			data.chats.forEach(chat => {
				totalUnread += chat.unread_count || 0
			})

			unreadCount = totalUnread

			updateNotificationBadge()
		} else {
			console.log('Ошибка сервера:', data.error)
		}
	} catch (error) {
		console.error('Ошибка загрузки:', error)
	}
}

function updateNotificationBadge() {
	const chatsTab = document.querySelector('.nav-link[data-tab="chats"]')

	if (!chatsTab) {
		return
	}

	let badge = chatsTab.querySelector('.notification-badge')

	if (!badge) {
		badge = document.createElement('span')
		badge.className = 'notification-badge'
		chatsTab.appendChild(badge)
	}

	if (unreadCount > 0) {
		badge.textContent = unreadCount > 99 ? '99+' : unreadCount
		badge.style.display = 'flex'
	} else {
		badge.style.display = 'none'
	}
}

async function loadProfile() {
	try {
		const userResponse = await fetch('/api/profile')
		const userData = await userResponse.json()

		if (userData.success) {
			const user = userData.user
			currentUser = user

			document.getElementById('userName').textContent = user.name
			document.getElementById('userEmail').textContent = user.email
			document.getElementById('userPhone').textContent = user.phone || ''
			const roleEl = document.getElementById('userRole')
			if (roleEl) {
				roleEl.textContent = user.role === 'admin' ? 'Роль: Администратор' : ''
			}
		}

		const ordersResponse = await fetch('/api/orders')
		const ordersData = await ordersResponse.json()

		if (ordersData.success) {
			allOrders = ordersData.orders
			displayedCount = 0
			showNextOrders()
		}

		await updateUnreadCount()
	} catch (error) {
		console.error('Ошибка загрузки профиля:', error)
	}
}

const modal = document.getElementById('editModal')
const editBtn = document.getElementById('editProfileBtn')
const closeBtn = document.querySelector('.close')
const form = document.getElementById('editProfileForm')

editBtn?.addEventListener('click', () => {
	if (currentUser) {
		document.getElementById('editName').value = currentUser.name
		document.getElementById('editEmail').value = currentUser.email
		document.getElementById('editPhone').value = currentUser.phone || ''
		modal.style.display = 'flex'
	}
})

closeBtn?.addEventListener('click', () => {
	modal.style.display = 'none'
})

window.addEventListener('click', event => {
	if (event.target === modal) {
		modal.style.display = 'none'
	}
})

form?.addEventListener('submit', async e => {
	e.preventDefault()

	const name = document.getElementById('editName').value.trim()
	const email = document.getElementById('editEmail').value.trim()
	const phone = document.getElementById('editPhone').value.trim()

	if (!name || !email) {
		alert('Имя и email обязательны')
		return
	}

	try {
		const response = await fetch('/api/profile', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ name, email, phone }),
		})

		const result = await response.json()

		if (result.success) {
			modal.style.display = 'none'

			currentUser = { ...currentUser, name, email, phone }
			loadProfile()
		} else {
			alert('Ошибка: ' + (result.error || 'Не удалось обновить профиль'))
		}
	} catch (error) {
		console.error('Ошибка обновления профиля:', error)
		alert('Ошибка подключения к серверу')
	}
})

function appendOrders(orders) {
	const ordersList = document.getElementById('ordersList')

	const html = orders
		.map(
			order => `
                <div class="order">
                    <h3 style='font-weight: 400'>${order.service_name}</h3>
                    
                    <p>Статус: 
                        <span class="status ${order.status}">${getStatusText(
				order.status
			)}</span>
                    </p>
                    <div style='display: flex; flex-direction: row; align-items: center; gap: 16px'>Создана: ${new Date(
											order.created_at
										).toLocaleDateString()} ${
				order.chat_id
					? `<button class='chat-btn' onclick="openChat(${order.chat_id})">Чат</button>`
					: ''
			}</div>
                    
                </div>
            `
		)
		.join('')

	ordersList.insertAdjacentHTML('beforebegin', html)
}

function displayOrders(orders) {
	const ordersList = document.getElementById('ordersList')
	ordersList.innerHTML = ''

	if (orders.length === 0 && allOrders.length === 0) {
		ordersList.innerHTML = '<p>У вас пока нет заявок</p>'
	}
}

function showNextOrders() {
	const start = displayedCount
	const end = start + 4
	const nextOrders = allOrders.slice(start, end)

	if (nextOrders.length === 0) {
		const loadMoreBtn = document.getElementById('loadMoreBtn')
		if (loadMoreBtn) loadMoreBtn.style.display = 'none'
		return
	}

	appendOrders(nextOrders)
	displayedCount = end

	const loadMoreBtn = document.getElementById('loadMoreBtn')
	if (loadMoreBtn && end < allOrders.length) {
		loadMoreBtn.style.display = 'block'
	} else if (loadMoreBtn) {
		loadMoreBtn.style.display = 'none'
	}
}

function getStatusText(status) {
	const statuses = {
		pending: 'На рассмотрении',
		in_progress: 'В работе',
		completed: 'Завершена',
		rejected: 'Отклонена',
	}
	return statuses[status] || status
}

async function loadChats() {
	try {
		const res = await fetch('/api/chats')
		const data = await res.json()
		const container = document.getElementById('chatsList')

		if (!data.success || !data.chats.length) {
			container.innerHTML = '<p>Нет активных чатов</p>'
			return
		}

		let totalUnread = 0
		data.chats.forEach(chat => {
			totalUnread += chat.unread_count || 0
		})
		unreadCount = totalUnread
		updateNotificationBadge()

		container.innerHTML = data.chats
			.map(
				chat => `
            <div class="chat-item" style="${
							chat.unread_count > 0 ? 'background-color: #007bff20;' : ''
						} border: 1px solid #eee;  margin-bottom: 16px; border-radius: 8px; cursor: pointer; position: relative;" onclick="openChat(${
					chat.chat_id
				})">
                ${
									chat.unread_count > 0
										? `<span class="unread-indicator" style="position: absolute; top: 10px; right: 10px; background: #ff4444; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px;">${chat.unread_count}</span>`
										: ''
								}
                <h3 style='font-weight: 600; color: #f44336'>${
									chat.service_name || 'Услуга'
								}</h3>
                <p><small>Заявка #${chat.order_id} от: ${new Date(
					chat.order_date
				).toLocaleDateString()}</small></p>
                ${
									chat.user_name
										? `<p><strong>Клиент:</strong> ${chat.user_name}</p>`
										: ''
								}
                ${
									chat.last_message
										? `<div class='last-message'>
           <span>Последнее сообщение:</span>
           <span>${chat.last_message}</span>
       </div>`
										: '<p>Нет сообщений</p>'
								}
                
            </div>
        `
			)
			.join('')
	} catch (err) {
		console.error('Ошибка загрузки чатов:', err)
		document.getElementById('chatsList').innerHTML =
			'<p>Ошибка загрузки чатов</p>'
	}
}

async function openChat(chatId) {
	try {
		await fetch('/api/chats/mark-read', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ chatId }),
		})

		await updateUnreadCount()
	} catch (err) {
		console.error('Ошибка отметки сообщений как прочитанных:', err)
	}

	window.location.href = `/chat?id=${chatId}`
}

document.addEventListener('DOMContentLoaded', () => {
	initWebSocket()
	loadProfile()
	updateUnreadCount()
})
document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
	showNextOrders()
})

document.querySelectorAll('.nav-link').forEach(link => {
	link.addEventListener('click', e => {
		e.preventDefault()

		document
			.querySelectorAll('.nav-link')
			.forEach(l => l.classList.remove('active'))
		document
			.querySelectorAll('.main-content > section')
			.forEach(sec => sec.classList.remove('active'))

		link.classList.add('active')
		const tabId = link.getAttribute('data-tab')
		const tab = document.getElementById(tabId)
		tab.classList.add('active')

		if (tabId === 'chats') {
			loadChats()
		}
	})
})
