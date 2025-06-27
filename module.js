const { InstanceBase, TCPHelper, runEntrypoint, Regex } = require('@companion-module/base')

class BarcoSeries4Instance extends InstanceBase {
  constructor(internal) {
    super(internal)
    this.tcp = null
  }

  async init(config) {
    this.config = config
    this.updateStatus('connecting')

    if (this.tcp) {
      this.tcp.destroy()
    }

    if (this.config.host) {
      this.tcp = new TCPHelper(this.config.host, this.config.port || 43731)

      this.tcp.on('status_change', (status, message) => {
        this.updateStatus(status, message)
      })

      this.tcp.on('error', (err) => {
        this.log('error', 'TCP Error: ' + err.message)
      })

      this.tcp.on('connect', () => {
        this.updateStatus('ok')
      })
    }

    this.initActions()
  }

  async destroy() {
    if (this.tcp) {
      this.tcp.destroy()
    }
  }

  async configUpdated(config) {
    this.config = config
    await this.init(config)
  }

  getConfigFields() {
    return [
      {
        type: 'textinput',
        id: 'host',
        label: 'Target IP',
        width: 6,
        default: '192.168.0.100',
        regex: Regex.IP
      },
      {
        type: 'number',
        id: 'port',
        label: 'Port',
        width: 6,
        default: 43731
      }
    ]
  }

  initActions() {
    this.setActionDefinitions({
      lamp: {
        name: 'Lamp control',
        options: [
          {
            type: 'dropdown',
            label: 'On/Off',
            id: 'lamp',
            default: 'lamp_on',
            choices: [
              { id: 'lamp_on', label: 'Lamp On' },
              { id: 'lamp_off', label: 'Lamp Off' },
            ],
          },
        ],
        callback: ({ options }) => {
          const cmd = this.getCommandValue(Buffer.from([0x00, 0x03, 0x02, 0x76, 0x1a]), options.lamp === 'lamp_on' ? '1' : '0')
          this.sendCommand(cmd)
        },
      },
      shutter: {
        name: 'Shutter',
        options: [
          {
            type: 'dropdown',
            label: 'Open/Close',
            id: 'shutter',
            default: 'shutter_close',
            choices: [
              { id: 'shutter_open', label: 'Open' },
              { id: 'shutter_close', label: 'Close' },
            ],
          },
        ],
        callback: ({ options }) => {
          const cmd = options.shutter === 'shutter_open'
            ? Buffer.from([0xfe, 0x00, 0x22, 0x42, 0x00, 0x64, 0xff])
            : Buffer.from([0xfe, 0x00, 0x23, 0x42, 0x00, 0x65, 0xff])
          this.sendCommand(cmd)
        },
      },
      lensShift: {
        name: 'Lens Shift',
        options: [
          {
            type: 'dropdown',
            label: 'Direction',
            id: 'side',
            default: '0',
            choices: [
              { id: '0', label: 'Up' },
              { id: '1', label: 'Down' },
              { id: '2', label: 'Left' },
              { id: '3', label: 'Right' },
            ],
          },
        ],
        callback: ({ options }) => {
          const cmd = this.getCommandValue(Buffer.from([0xf4, 0x81]), options.side)
          this.sendCommand(cmd)
        },
      },
      lensZoom: {
        name: 'Lens Zoom',
        options: [
          {
            type: 'dropdown',
            label: 'Zoom',
            id: 'zoom',
            default: '0',
            choices: [
              { id: '0', label: 'Zoom In' },
              { id: '1', label: 'Zoom Out' },
            ],
          },
        ],
        callback: ({ options }) => {
          const cmd = this.getCommandValue(Buffer.from([0xf4, 0x82]), options.zoom)
          this.sendCommand(cmd)
        },
      },
      lensFocus: {
        name: 'Lens Focus',
        options: [
          {
            type: 'dropdown',
            label: 'Focus',
            id: 'focus',
            default: '0',
            choices: [
              { id: '0', label: 'Near' },
              { id: '1', label: 'Far' },
            ],
          },
        ],
        callback: ({ options }) => {
          const cmd = this.getCommandValue(Buffer.from([0xf4, 0x83]), options.focus)
          this.sendCommand(cmd)
        },
      },
      macro: {
        name: 'Execute Macro',
        options: [
          {
            type: 'textinput',
            label: 'Macro Name',
            id: 'macro',
          },
        ],
        callback: ({ options }) => {
          const cmd = this.getCommandValue(Buffer.concat([Buffer.from([0xe8, 0x81]), Buffer.from(options.macro)]), null)
          this.sendCommand(cmd)
        },
      },
    })
  }

  getCommandValue(command, parameter) {
    let checksum = 0
    command.forEach((b) => (checksum += b))

    if (parameter !== null) {
      const pBuffer = Buffer.from([parseInt(parameter)])
      pBuffer.forEach((b) => (checksum += b))
      checksum = checksum % 256

      return Buffer.concat([
        Buffer.from([0xfe, 0x00]),
        command,
        pBuffer,
        Buffer.from([checksum]),
        Buffer.from([0xff]),
      ])
    } else {
      checksum = checksum % 256
      return Buffer.concat([
        Buffer.from([0xfe, 0x00]),
        command,
        Buffer.from([0x00]),
        Buffer.from([checksum]),
        Buffer.from([0xff]),
      ])
    }
  }

  sendCommand(cmd) {
    if (this.tcp && this.tcp.isConnected) {
      this.tcp.send(cmd)
    } else {
      this.log('warn', 'TCP not connected')
    }
  }
}

runEntrypoint(BarcoSeries4Instance)
