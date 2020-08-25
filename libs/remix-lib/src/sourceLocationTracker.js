'use strict'
const EventManager = require('./eventManager')
const helper = require('./helpers/traceHelper')
const SourceMappingDecoder = require('./sourceMappingDecoder')
const util = require('./util')

/**
 * Process the source code location for the current executing bytecode
 */
function SourceLocationTracker (_codeManager) {
  this.codeManager = _codeManager
  this.event = new EventManager()
  this.sourceMappingDecoder = new SourceMappingDecoder()
  this.sourceMapByAddress = {}
  this.generatedSourcesByAddress = {}
}

/**
 * Return the source location associated with the given @arg index
 *
 * @param {String} address - contract address from which the source location is retrieved
 * @param {Int} index - index in the instruction list from where the source location is retrieved
 * @param {Object} contractDetails - AST of compiled contracts
 * @param {Function} cb - callback function
 */
SourceLocationTracker.prototype.getSourceLocationFromInstructionIndex = function (address, index, contracts) {
  return new Promise((resolve, reject) => {
    extractSourceMap(this, this.codeManager, address, contracts).then((sourceMap) => {
      resolve(this.sourceMappingDecoder.atIndex(index, sourceMap.map))
    }).catch(reject)
  })
}

/**
 * Return the source location associated with the given @arg pc
 *
 * @param {String} address - contract address from which the source location is retrieved
 * @param {Int} vmtraceStepIndex - index of the current code in the vmtrace
 * @param {Object} contractDetails - AST of compiled contracts
 * @param {Function} cb - callback function
 */
SourceLocationTracker.prototype.getSourceLocationFromVMTraceIndex = function (address, vmtraceStepIndex, contracts) {
  return new Promise((resolve, reject) => {
    extractSourceMap(this, this.codeManager, address, contracts, (error, sourceMap) => {
      if (!error) {
        this.codeManager.getInstructionIndex(address, vmtraceStepIndex, (error, index) => {
          if (error) {
            reject(error)
          } else {
            resolve(this.sourceMappingDecoder.atIndex(index, sourceMap.map))
          }
        })
      } else {
        reject(error)
      }
    })
  })
}

/**
 * Returns the generated sources from a specific @arg address
 *
 * @param {String} address - contract address from which has generated sources
 * @param {Object} generatedSources - Object containing the sourceid, ast and the source code.
 */
SourceLocationTracker.prototype.getGeneratedSourcesFromAddress = function (address) {
  if (this.generatedSourcesByAddress[address]) return this.generatedSourcesByAddress[address]
  return null
}

SourceLocationTracker.prototype.clearCache = function () {
  this.sourceMapByAddress = {}
  this.generatedSourcesByAddress = {}
}

function getSourceMap (address, code, contracts) {
  const isCreation = helper.isContractCreation(address)
  let bytes
  for (let file in contracts) {
    for (let contract in contracts[file]) {
      const bytecode = contracts[file][contract].evm.bytecode
      const deployedBytecode = contracts[file][contract].evm.deployedBytecode
      if (!deployedBytecode) continue

      bytes = isCreation ? bytecode.object : deployedBytecode.object
      if (util.compareByteCode(code, '0x' + bytes)) {
        const generatedSources = isCreation ? bytecode.generatedSources : deployedBytecode.generatedSources
        const map = isCreation ? bytecode.sourceMap : deployedBytecode.sourceMap
        return { generatedSources, map }
      }
    }
  }
  return null
}

function extractSourceMap (self, codeManager, address, contracts, cb) {
  if (self.sourceMapByAddress[address]) return cb(null, { map: self.sourceMapByAddress[address], generatedSources: self.generatedSourcesByAddress[address] })

  codeManager.getCode(address, (error, result) => {
    if (!error) {
      const sourceMap = getSourceMap(address, result.bytecode, contracts)
      if (sourceMap) {
        if (!helper.isContractCreation(address)) self.sourceMapByAddress[address] = sourceMap.map
        self.generatedSourcesByAddress[address] = sourceMap.generatedSources
        cb(null, { map: sourceMap.map, generatedSources: sourceMap.generatedSources })
      } else {
        cb('no sourcemap associated with the code ' + address)
      }
    } else {
      cb(error)
    }
  })
}

module.exports = SourceLocationTracker
