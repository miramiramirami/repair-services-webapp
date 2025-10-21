let currentPage = 1
const servicesPerPage = 6
let allServices = []
let currentModalService = null

async function loadServices() {
	try {
		const response = await fetch('/api/services')
		const data = await response.json()

		if (data.success) {
			allServices = data.services
			renderPage(currentPage)
			renderPagination()
		} else {
			console.error('Ошибка загрузки услуг:', data.error)
			document.getElementById('servicesList').innerHTML =
				'<div class="no-services">Ошибка загрузки: ' + data.error + '</div>'
		}
	} catch (error) {
		console.error('Ошибка:', error)
		document.getElementById('servicesList').innerHTML =
			'<div class="no-services">Ошибка загрузки услуг</div>'
	}
}

function renderPage(page) {
	const startIndex = (page - 1) * servicesPerPage
	const endIndex = startIndex + servicesPerPage
	const pageServices = allServices.slice(startIndex, endIndex)

	const servicesContainer = document.getElementById('servicesList')

	if (!pageServices || pageServices.length === 0) {
		servicesContainer.innerHTML =
			'<div class="no-services">Услуги временно недоступны</div>'
		return
	}

	servicesContainer.innerHTML = pageServices
		.filter(service => service.is_active)
		.map(
			service => `
            <div class="service-card" data-service='${JSON.stringify(
							service
						).replace(/'/g, '&#39;')}'>
                <h3 >${service.name}</h3>
                <p class="price">${
									service.price
										? 'От ' + service.price + ' руб. за усл. >'
										: 'Цена по запросу'
								}</p>
            </div>
        `
		)
		.join('')
}

function renderPagination() {
	const totalPages = Math.ceil(
		allServices.filter(service => service.is_active).length / servicesPerPage
	)
	const pagination = document.getElementById('pagination')

	if (!pagination) return

	let buttons = ''

	if (currentPage > 1) {
		buttons += `<button onclick="goToPage(${currentPage - 1})">← Назад</button>`
	}

	for (let i = 1; i <= totalPages; i++) {
		if (i === currentPage) {
			buttons += `<button disabled style="background: #007bff; padding: 8px; color: white; border: none">${i}</button>`
		} else {
			buttons += `<button onclick="goToPage(${i})">${i}</button>`
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

function orderService(serviceId) {
	localStorage.setItem('selectedService', serviceId)
	window.location.href = '/create-order'
}

function openServiceModal(service) {
	currentModalService = service

	document.getElementById('modalServiceName').textContent = service.name

	const priceEl = document.getElementById('modalServicePrice')
	priceEl.textContent = service.price
		? `От ${service.price} руб.`
		: 'Цена по запросу'

	document.getElementById('modalServiceDescription').textContent =
		service.description || 'Описание отсутствует'

	document.getElementById('serviceModal').style.display = 'flex'
}


document.addEventListener('click', function (e) {

	if (e.target.classList.contains('service-card')) {
		const serviceCard = e.target.closest('.service-card')
		const serviceData = JSON.parse(
			serviceCard.getAttribute('data-service').replace(/&#39;/g, "'")
		)
		openServiceModal(serviceData)
	}


	if (e.target.id === 'modalClose') {
		document.getElementById('serviceModal').style.display = 'none'
	}


	if (e.target.id === 'modalOrderBtn' && currentModalService) {
		orderService(currentModalService.id)
		document.getElementById('serviceModal').style.display = 'none'
	}
})


window.addEventListener('click', function (e) {
	if (e.target.id === 'serviceModal') {
		document.getElementById('serviceModal').style.display = 'none'
	}
})

document.addEventListener('DOMContentLoaded', loadServices)
