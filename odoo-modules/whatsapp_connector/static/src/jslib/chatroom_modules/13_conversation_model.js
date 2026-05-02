odoo.define('@whatsapp_connector/chatroom_mod/conversation-model', ['@whatsapp_connector/chatroom_mod/chat-base-model', '@whatsapp_connector/chatroom_mod/message-model', '@web/core/l10n/dates'], function (require) {
    'use strict'; let __exports = {}; const { ChatBaseModel } = require('@whatsapp_connector/chatroom_mod/chat-base-model')
    const { MessageModel } = require('@whatsapp_connector/chatroom_mod/message-model')
    const { deserializeDateTime } = require('@web/core/l10n/dates')
    const ConversationModel = __exports.ConversationModel = class ConversationModel extends ChatBaseModel {
        constructor(comp, base) {
            super(comp)
            this.env
            this.id = false
            this.name = ''
            this.numberFormat = ''
            this.status = 'new'
            this.borderColor = '#FFFFFF'
            this.imageUrl = ''
            this.team = { id: false, name: '' }
            this.partner = { id: false, name: '' }
            this.agent = { id: false, name: '' }
            this.connector = { id: false, name: '' }
            this.connectorType = ''
            this.showIcon = false
            this.allowSigning = false
            this.assigned = false
            this.messages = []
            this.messagesIds = new Set()
            this.countNewMsg = 0
            this.lastActivity = luxon.DateTime.now()
            this.tagIds = []
            this.note = ''
            this.allowedLangIds = []
            this.convType = 'normal'
            this.oldesActivityDate = null
            this.freeText = ''
            this.data = {}
            if (base) { this.updateFromJson(base) }
            this.model = { load: this.load.bind(this) }
        }
        updateFromJson(base) {
            super.updateFromJson(base)
            if ('id' in base) {
                this.id = base.id
                this.resId = base.id
                this.resModel = 'acrux.chat.conversation'
            }
            if ('name' in base) { this.name = base.name }
            if ('number_format' in base) { this.numberFormat = base.number_format }
            if ('status' in base) { this.status = base.status }
            if ('border_color' in base) { this.borderColor = base.border_color }
            if ('image_url' in base) { this.imageUrl = base.image_url }
            if ('team_id' in base) { this.team = this.convertRecordField(base.team_id) }
            if ('res_partner_id' in base) { this.partner = this.convertRecordField(base.res_partner_id) }
            if ('agent_id' in base) { this.agent = this.convertRecordField(base.agent_id) }
            if ('connector_id' in base) { this.connector = this.convertRecordField(base.connector_id) }
            if ('connector_type' in base) { this.connectorType = base.connector_type }
            if ('show_icon' in base) { this.showIcon = base.show_icon }
            if ('allow_signing' in base) { this.allowSigning = base.allow_signing }
            if ('assigned' in base) { this.assigned = base.assigned }
            if ('messages' in base) { this.appendMessages(base.messages) }
            if ('last_activity' in base) { this.lastActivity = deserializeDateTime(base.last_activity) }
            if ('tag_ids' in base) { this.tagIds = base.tag_ids }
            if ('note' in base) { this.note = base.note }
            if ('allowed_lang_ids' in base) { this.allowedLangIds = base.allowed_lang_ids }
            if ('conv_type' in base) { this.convType = base.conv_type }
            if ('oldes_activity_date' in base) { this.oldesActivityDate = deserializeDateTime(base.oldes_activity_date) }
            if ('free_text' in base) { this.freeText = base.free_text }
            this.data = Object.assign({}, this.data, base)
            if ('activity_ids' in this.data) { if (Array.isArray(this.data.activity_ids)) { this.data.activity_ids = { currentIds: this.data.activity_ids, records: [] } } }
        }
        copyFromObj(conv) {
            Object.assign(this, conv)
            for (const msg of this.messages) { msg.conversation = this }
        }
        async buildExtraObj() {
            await super.buildExtraObj()
            for await (const msg of this.messages) { await msg.buildExtraObj() }
        }
        async load() {
            const result = await this.env.services.orm.call(this.env.chatModel, 'build_dict', [[this.id]], { context: this.env.context, limit: 22 })
            this.env.services.bus_service.trigger('notification', [{ type: 'update_conversation', payload: result, }])
        }
        appendMessages(messages) {
            if (messages?.length > 0) {
                const newMessages = []
                for (const msg of messages) {
                    if (this.messagesIds.has(msg.id)) {
                        const oldMsg = this.messages.find(item => item.id === msg.id)
                        oldMsg.updateFromJson(msg)
                    } else { newMessages.push(new MessageModel(this, msg)) }
                }
                for (const msg of newMessages) { this.messagesIds.add(msg.id) }
                this.messages.push(...newMessages)
                this.messages.sort((a, b) => a.id - b.id)
            }
            this.calculateMessageCount()
        }
        calculateMessageCount() {
            if (['new', 'current'].includes(this.status)) {
                const messages = this.messages.filter(msg => !msg.ttype.startsWith('info'))
                let lastIndexOf
                if (Array.prototype.findLastIndex) { lastIndexOf = messages.findLastIndex(msg => msg.fromMe) } else { lastIndexOf = messages.map(msg => msg.fromMe).lastIndexOf(true) }
                this.countNewMsg = messages.length - (lastIndexOf + 1)
            } else { this.countNewMsg = 0 }
        }
        async syncMoreMessage() {
            if (this.messages.length >= 22) {
                const result = await this.env.services.orm.call(this.env.chatModel, 'build_dict', [[this.id]], { context: this.env.context, limit: 22, offset: this.messages.length })
                this.appendMessages(result[0].messages)
                await this.buildExtraObj()
            }
        }
        async createMessage(options) {
            let msg = new MessageModel(this, options)
            const jsonData = msg.exportToVals()
            if (options.custom_field) { jsonData[options.custom_field] = true }
            const result = await this.env.services.orm.call(this.env.chatModel, 'send_message', [[this.id], jsonData], { context: this.env.context })
            msg.updateFromJson(result[0])
            await msg.buildExtraObj()
            if (this.messagesIds.has(msg.id)) { msg = this.messages.find(msg2 => msg2.id === msg.id) } else {
                this.messagesIds.add(msg.id)
                this.messages.push(msg)
            }
            this.lastActivity = luxon.DateTime.now()
            this.env.chatBus.trigger('mobileNavigate', 'middleSide')
            this.calculateMessageCount()
            return msg
        }
        async sendProduct(productId) { await this.env.services.orm.call(this.env.chatModel, 'send_message_product', [[this.id], parseInt(productId)], { context: this.env.context }) }
        async messageSeen() { try { await this.env.services.orm.silent.call(this.env.chatModel, 'conversation_send_read', [[this.id]], { context: this.env.context }) } catch (e) { console.error(e) } }
        isMine() { return (this.status === 'current' && this.agent.id === this.env.services.user.userId) }
        isCurrent() {
            let out = this.status === 'current'
            if (!this.env.isAdmin()) { out = out && this.agent.id === this.env.services.user.userId }
            return out
        }
        getIconClass() {
            let out = 'acrux_whatsapp'
            if (this.connectorType === 'facebook') { out = 'acrux_messenger' } else if (this.connectorType === 'instagram') { out = 'acrux_instagram' }
            return out
        }
        async block() {
            const conv = await this.env.services.orm.call(this.env.chatModel, 'block_conversation', [this.id], { context: this.env.context })
            this.updateFromJson(conv[0])
            this.assigned = false
        }
        async release() { await this.env.services.orm.call(this.env.chatModel, 'release_conversation', [this.id], { context: this.env.context }) }
        get lastMessage() {
            let out = null
            if (this.messages.length) {
                const messages = this.messages.filter(msg => msg.ttype !== 'info')
                if (messages.length) { out = messages[messages.length - 1] }
            }
            return out
        }
        get isPrivate() { return this.convType === 'private' }
        get isGroup() { return this.convType === 'group' }
        async selected() {
            if (this.isCurrent()) { this.messageSeen() }
            this.assigned = false
        }
        async close() { try { await this.env.services.orm.silent.call(this.env.chatModel, 'close_from_ui', [[this.id]], { context: this.env.context }) } catch (e) { console.error(e) } }
        isOwnerFacebook() { return ['facebook', 'instagram', 'waba_extern'].includes(this.connectorType) }
        isWabaExtern() { return this.connectorType === 'waba_extern' }
    }
    return __exports;
});;
