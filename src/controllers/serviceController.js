const querystring = require('querystring')
const db = require('../utils/database')
const { IncomingForm } = require('formidable')
const path = require('path')
const fs = require('fs')

async function createService(req, res) {
	const form = new IncomingForm({
		uploadDir: path.join(__dirname, '../../public/uploads/services'),
		keepExtensions: true,
		maxFileSize: 5 * 1024 * 1024,
	})

	form.parse(req, async (err, fields, files) => {
		if (err) {
			console.error(err)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			return res.end(JSON.stringify({ error: 'Ошибка загрузки файла' }))
		}

		const { name, description, price, is_active } = fields

		if (!name || !description || !price) {
			res.writeHead(400, { 'Content-Type': 'application/json' })
			return res.end(JSON.stringify({ error: 'Все поля обязательны' }))
		}

		let imageUrl = null

		if (files.image) {
			const file = Array.isArray(files.image) ? files.image[0] : files.image
			const originalFilename =
				file.originalFilename || file.newFilename || 'unknown' //

			const ext = originalFilename ? path.extname(originalFilename) : ''
			const fileName = Date.now() + ext
			const newPath = path.join(
				__dirname,
				'../../public/uploads/services',
				fileName
			)

			await fs.promises.rename(file.filepath, newPath)

			imageUrl = `/uploads/services/${fileName}`
		}

		try {
			const result = await db(
				'INSERT INTO services (name, image_url, description,  price, is_active) VALUES (?, ?, ?, ?, ?)',
				[name, imageUrl, description, price, is_active]
			)

			res.writeHead(201, { 'Content-Type': 'application/json' })
			res.end(
				JSON.stringify({
					success: true,
					message: 'Услуга создана',
					serviceId: result.insertId,
				})
			)
		} catch (error) {
			console.error('Ошибка создания услуги:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка создания услуги' }))
		}
	})
}

async function getAdminServices(req, res) {
	try {
		const services = await db('SELECT * FROM services ORDER BY created_at DESC')

		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ success: true, services }))
	} catch (error) {
		console.error('Ошибка получения услуг:', error)
		res.writeHead(500, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Ошибка сервера' }))
	}
}

async function toggleService(req, res, serviceId) {
	let body = ''
	req.on('data', chunk => {
		body += chunk.toString()
	})

	req.on('end', async () => {
		try {
			const data = JSON.parse(body)
			const { is_active } = data

			await db('UPDATE services SET is_active = ? WHERE id = ?', [
				is_active,
				serviceId,
			])

			res.writeHead(200, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ success: true, message: 'Статус обновлён' }))
		} catch (error) {
			console.error('Ошибка изменения статуса услуги:', error)
			res.writeHead(500, { 'Content-Type': 'application/json' })
			res.end(JSON.stringify({ error: 'Ошибка сервера' }))
		}
	})
}

async function deleteService(req, res, serviceId) {
	try {
		await db('DELETE FROM services WHERE id = ?', [serviceId])

		res.writeHead(200, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ success: true, message: 'Услуга удалена' }))
	} catch (error) {
		console.error('Ошибка удаления услуги:', error)
		res.writeHead(500, { 'Content-Type': 'application/json' })
		res.end(JSON.stringify({ error: 'Ошибка сервера' }))
	}
}

module.exports = {
	createService,
	getAdminServices,
	toggleService,
	deleteService,
}
