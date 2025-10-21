async function loadServices() {
	try {
		const response = await fetch('/api/services')
		const data = await response.json()

		if (data.success) {
			const select = document.getElementById('service')
			data.services.forEach(service => {
				const option = document.createElement('option')
				option.value = service.id
				option.textContent = `${service.name} - ${service.price} руб.`
				select.appendChild(option)
			})
		}
	} catch (error) {
		console.error('Ошибка загрузки услуг:', error)
	}
}

document.getElementById('orderForm').addEventListener('submit', async e => {
	e.preventDefault()

	try {
		const formData = new FormData(e.target)
		const response = await fetch('/api/orders', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
			},
			body: new URLSearchParams(formData),
		})

		const result = await response.json()
		if (result.success) {
			window.location.href = '/profile'
		} else {
			alert(result.error)
		}
	} catch (error) {
		console.error('Ошибка:', error)
		alert('Произошла ошибка при создании заявки')
	}
})

async function getPhone() {
	const profileRes = await fetch('/api/profile')
	const profileData = await profileRes.json()

	if (profileData.success && profileData.user.phone) {
		document.getElementById('user_phone').value = profileData.user.phone
	}
}

window.addEventListener('DOMContentLoaded', () => {
	loadServices().then(() => {
		const savedServiceId = localStorage.getItem('selectedService')

		if (savedServiceId) {
			const select = document.getElementById('service')
			select.value = savedServiceId
			localStorage.removeItem('selectedService')
		}

		getPhone()
	})
})
