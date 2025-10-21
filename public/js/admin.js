document.getElementById('addServiceBtn').onclick = () => {
	document.getElementById('modal').style.display = 'block'
}

function closeModal() {
	document.getElementById('modal').style.display = 'none'
}

document.getElementById('serviceForm').onsubmit = async e => {
	e.preventDefault()

	const formData = new FormData()
	formData.append('name', document.getElementById('serviceName').value)
	formData.append(
		'description',
		document.getElementById('serviceDescription').value
	)
	formData.append('price', document.getElementById('servicePrice').value)
	formData.append(
		'is_active',
		document.getElementById('serviceActive').checked ? 1 : 0
	)

	const imageInput = document.getElementById('serviceImage')
	if (imageInput) {
		formData.append('image', imageInput.files[0])
	}

	const response = await fetch('/api/admin/services', {
		method: 'POST',
		body: formData,
	})

	if (response.ok) {
		closeModal()
		loadServices()
	} else {
		const err = await response.json()
		alert('Ошибка: ' + err.error)
	}
}

let currentServicePage = 1
const servicesPerPage = 4
let allServices = []

async function loadServices() {
	const response = await fetch('/api/admin/services')
	const data = await response.json()

	if (data.success) {
		allServices = data.services
		renderServicePage(currentServicePage)
		renderServicePagination()
	} else {
		document.getElementById('servicesList').innerHTML =
			'<p>Ошибка загрузки услуг</p>'
		document.getElementById('servicesPagination').innerHTML = ''
	}
}

function renderServicePage(page) {
	const startIndex = (page - 1) * servicesPerPage
	const endIndex = startIndex + servicesPerPage
	const pageServices = allServices.slice(startIndex, endIndex)

	const list = document.getElementById('servicesList')
	if (pageServices.length === 0) {
		list.innerHTML = '<p>Услуг нет</p>'
		return
	}

	list.innerHTML = pageServices
		.map(
			service => `
		<div class="service-item">
					<h3>${service.name}</h3>
					<p>${service.description}</p>
					<p>Цена: <strong>${service.price} руб.</strong></p>
					<p>Статус: <span class="${
						service.is_active == 1 ? 'status-active' : 'status-inactive'
					}">
						${service.is_active == 1 ? 'Активна' : 'Неактивна'}
					</span></p>
					<button onclick="toggleService(${service.id}, ${service.is_active})">
						${service.is_active == 1 ? 'Деактивировать' : 'Активировать'}
					</button>
					<button onclick="deleteService(${
						service.id
					})" style="color:red">Удалить</button>
				</div>`
		)
		.join('')
}

function renderServicePagination() {
	const totalPages = Math.ceil(allServices.length / servicesPerPage)
	const pagination = document.getElementById('servicesPagination')

	if (!pagination) return

	let buttons = ''

	if (currentServicePage > 1) {
		buttons += `<button onclick="goToServicePage(${
			currentServicePage - 1
		})">← Назад</button>`
	}

	for (let i = 1; i <= totalPages; i++) {
		if (i === currentServicePage) {
			buttons += `<button disabled style="background: #007bff; color: white;">${i}</button>`
		} else {
			buttons += `<button onclick="goToServicePage(${i})">${i}</button>`
		}
	}

	if (currentServicePage < totalPages) {
		buttons += `<button onclick="goToServicePage(${
			currentServicePage + 1
		})">Вперёд →</button>`
	}

	pagination.innerHTML = buttons
}

async function toggleService(id, currentStatus) {
	const newStatus = currentStatus == 1 ? 0 : 1
	await fetch(`/api/admin/services/${id}/toggle`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ is_active: newStatus }),
	})
	loadServices()
}

function goToServicePage(page) {
	currentServicePage = page
	renderServicePage(page)
	renderServicePagination()
}

async function deleteService(id) {
	if (confirm('Удалить услугу?')) {
		await fetch(`/api/admin/services/${id}`, { method: 'DELETE' })
		loadServices()
	}
}

async function loadAdminData() {
	try {
		const response = await fetch('/api/admin/orders')
		if (response.status === 403) {
			window.location.href = '/profile'
			return
		}

		const data = await response.json()
		if (data.success) {
			displayOrders(data.orders)
		}
	} catch (error) {
		console.error('Ошибка загрузки данных:', error)
		if (
			error instanceof TypeError &&
			error.message.includes('Failed to fetch')
		) {
			alert('Ошибка доступа.')
			window.location.href = '/profile'
		}
	}
}

let currentPage = 1
const ordersPerPage = 6
let allOrders = []

function displayOrders(orders) {
	allOrders = orders

	if (orders.length === 0) {
		document.getElementById('ordersList').innerHTML = '<p>Заявок нет</p>'
		document.getElementById('pagination').innerHTML = ''
		return
	}

	renderPage(currentPage)
	renderPagination()
}

function renderPage(page) {
	const startIndex = (page - 1) * ordersPerPage
	const endIndex = startIndex + ordersPerPage
	const pageOrders = allOrders.slice(startIndex, endIndex)

	const ordersList = document.getElementById('ordersList')
	ordersList.innerHTML = pageOrders
		.map(
			order => `
        <div class="order-card">
            <h3>${order.service_name}</h3>
            <p><span>От: </span>${order.user_name} (${order.email})</p>
            <p><span>Телефон: </span>${order.user_phone}</p>
            <p><span>Адрес: </span> ${order.user_address}</p>
            <p><span>Описание:</span> ${order.description}</p>
            <p><span>Статус:</span>
                <span class="status ${order.status}">${getStatusText(
				order.status
			)}</span>
            </p>
            <p><span>Создана:</span> ${new Date(
							order.created_at
						).toLocaleString()}</p>
            
            <div>
                <label>Изменить статус:</label>
                <select id="status-${order.id}">
                    <option value="pending" ${
											order.status === 'pending' ? 'selected' : ''
										}>На рассмотрении</option>
                    <option value="in_progress" ${
											order.status === 'in_progress' ? 'selected' : ''
										}>В работе</option>
                    <option value="completed" ${
											order.status === 'completed' ? 'selected' : ''
										}>Завершена</option>
                    <option value="rejected" ${
											order.status === 'rejected' ? 'selected' : ''
										}>Отклонена</option>
                </select>
            </div>
            
            <div>
                <label>Комментарий:</label>
                <textarea id="notes-${
									order.id
								}" placeholder="Комментарий администратора" 
                          rows="3" style="width: 100%; margin: 5px 0; font-family: inherit; padding: 6px">${
														order.admin_notes || ''
													}</textarea>
            </div>

            <button onclick="updateStatus(${
							order.id
						})" style="margin-top: 10px; padding: 8px 16px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Сохранить изменения
            </button>
			${
				order.admin_notes
					? `
					<div>
						<b>Комментарий администратора: </b> <p>${order.admin_notes}</p>
					</div>
				`
					: ''
			}
			
        </div>
    `
		)
		.join('')
}

function renderPagination() {
	const totalPages = Math.ceil(allOrders.length / ordersPerPage)
	const pagination = document.getElementById('pagination')

	let buttons = ''

	if (currentPage > 1) {
		buttons += `<button onclick="goToPage(${currentPage - 1})">← Назад</button>`
	}

	for (let i = 1; i <= totalPages; i++) {
		if (i === currentPage) {
			buttons += `
			<button 
				disabled 
				style="
					background: #007bff; 
					color: white; 
					border: 2px solid #0056b3; 
					font-weight: bold; 
					cursor: default;
					padding: 8px 16px;
					border-radius: 4px;
				"
			>
				${i}
			</button>`
		} else {
			buttons += `
			<button 
				onclick="goToPage(${i})" 
				style="
					background: #f8f9fa; 
					color: #495057; 
					border: 1px solid #dee2e6; 
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
				"
			>
				${i}
			</button>`
		}
	}

	if (currentPage < totalPages) {
		buttons += `<button onclick="goToPage(${
			currentPage + 1
		})">Вперёд →</button>`
	}

	pagination.innerHTML = buttons
}

function goToPage(page) {
	currentPage = page
	renderPage(page)
	renderPagination()
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

async function updateStatus(orderId) {
	const status = document.getElementById(`status-${orderId}`).value
	const notes = document.getElementById(`notes-${orderId}`).value

	try {
		const response = await fetch('/api/admin/orders/status', {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams({
				order_id: orderId,
				status: status,
				admin_notes: notes,
			}),
		})

		const result = await response.json()
		if (result.success) {
			loadAdminData()
		} else {
			alert('Ошибка: ' + result.error)
		}
	} catch (error) {
		console.error('Ошибка обновления статуса:', error)
		alert('Ошибка обновления статуса')
	}
}

async function logout() {
	await fetch('/logout', { method: 'POST' })
	window.location.href = '/'
}

loadAdminData()
loadServices()
