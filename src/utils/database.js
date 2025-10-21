const mysql = require('mysql')
const CONFIG = require('./config')

const pool = mysql.createPool({
	...CONFIG,
	connectionLimit: 10,
	acquireTimeout: 60000,
	timeout: 60000,
})

// function database1(query) {
// 	const connection = mysql.createConnection(CONFIG)

// 	connection.connect(err => {
// 		if (err) {
// 			console.error(err)
// 			return
// 		}

// 		console.log('подключение к bd установленно')

// 		connection.query(query, (err, result) => {
// 			if (err) {
// 				console.error('Ошибка запроса:', err)
// 			} else {
// 				console.log('Результат:', result)
// 			}

// 			connection.end()
// 		})
// 	})
// }

function database(query, params = []) {
	return new Promise((resolve, reject) => {
		pool.getConnection((err, connection) => {
			if (err) {
				console.error('Ошибка подключения:', err)
				return reject(err)
			}

			connection.query(query, params, (error, results) => {
				connection.release()

				if (error) {
					console.error('Ошибка запроса:', error)
					return reject(error)
				}

				resolve(results)
			})
		})
	})
}

process.on('SIGINT', () => {
	pool.end(() => {
		process.exit(0)
	})
})

module.exports = database
