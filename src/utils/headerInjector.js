const fs = require('fs')
const path = require('path')

function injectHeader(htmlContent) {
	const headerPath = path.join(__dirname, '../../public/html/header.html')

	try {
		const headerContent = fs.readFileSync(headerPath, 'utf-8')

		return htmlContent.replace('<body>', '<body>' + headerContent)
	} catch (error) {
		console.error('Ошибка загрузки header:', error)
		return htmlContent
	}
}

module.exports = { injectHeader }
