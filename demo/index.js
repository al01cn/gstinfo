import { getCharacterInfo } from '../dist/index.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFilePath = fileURLToPath(import.meta.url)
const currentDir = path.dirname(currentFilePath)
const charPath = path.join(currentDir, 'char.png')
const charInfo = await getCharacterInfo(charPath)
console.log(charInfo)
