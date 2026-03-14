import { getCharacterInfo } from '../dist/index.js'
import path from 'node:path'

const charPath = path.join(__dirname, 'char.png')
const charInfo = await getCharacterInfo(charPath)
console.log(charInfo)
