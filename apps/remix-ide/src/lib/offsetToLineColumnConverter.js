'use strict'
import { Plugin } from '@remixproject/engine'
import * as packageJson from '../../../../package.json'
const {OffsetToLineColumnConverter} = require('@remix-project/remix-lib')

const profile = {
  name: 'offsetToLineColumnConverter',
  methods: [],
  events: [],
  version: packageJson.version
}

export class OffsetToLineColumnConverter extends Plugin {
  constructor () {
    super(profile)
    this.lineBreakPositionsByContent = {}
    this.offsetToLineColumnConverter = new OffsetToLineColumnConverter()
  }

  offsetToLineColumn (rawLocation, file, sources, asts) {
    if (!this.lineBreakPositionsByContent[file]) {
      const sourcesArray = Object.keys(sources)
      if (!asts && file === 0 && sourcesArray.length === 1) {
        // if we don't have ast, we process the only one available content
        this.lineBreakPositionsByContent[file] = this.offsetToLineColumnConverter.getLinebreakPositions(sources[sourcesArray[0]].content)
      } else {
        for (var filename in asts) {
          const source = asts[filename]
          if (source.id === file) {
            this.lineBreakPositionsByContent[file] = this.offsetToLineColumnConverter.getLinebreakPositions(sources[filename].content)
            break
          }
        }
      }
    }
    return this.offsetToLineColumnConverter.convertOffsetToLineColumn(rawLocation, this.lineBreakPositionsByContent[file])
  }

  clear () {
    this.lineBreakPositionsByContent = {}
  }

  activate () {
    this.on('solidity', 'compilationFinished', () => {
      this.clear()
    })
  }
}
