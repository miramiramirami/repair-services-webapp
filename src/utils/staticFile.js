const mimeTypes = require('./types')
const fs = require('fs')
const path = require('path')
const { injectHeader } = require('./headerInjector')

const staticFile = (res, filePath, ext) => {
	const fullPath = path.join(__dirname, '../../public', filePath)
	const contentType = mimeTypes[ext] || 'application/octet-stream'

	const isTextFile = ['.html', '.css', '.js', '.txt', '.json'].includes(ext)

	fs.readFile(fullPath, isTextFile ? 'utf-8' : null, (err, data) => {
		if (err) {
			console.error(`Файл не найден: ${fullPath}`, err.message)
			res.statusCode = 404
			res.setHeader('Content-Type', 'text/html; charset=utf-8')
			return res.end('<h1>404 - Файл не найден</h1>')
		}

		res.setHeader('Content-Type', contentType)

		if (ext === '.html') {
			const htmlWithHeader = injectHeader(data.toString())
			res.end(htmlWithHeader)
		} else {
			res.end(data)
		}
	})
}

module.exports = staticFile
