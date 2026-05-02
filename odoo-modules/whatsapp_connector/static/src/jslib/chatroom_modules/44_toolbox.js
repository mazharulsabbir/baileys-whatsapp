odoo.define('@whatsapp_connector/chatroom_mod/toolbox', ['@web/core/browser/browser', '@web/core/checkbox/checkbox', '@web/core/utils/hooks', '@web/core/transition', '@web/core/select_menu/select_menu', '@odoo/owl', '@whatsapp_connector/chatroom_mod/emojis', '@whatsapp_connector/chatroom_mod/activity-button', '@whatsapp_connector/chatroom_mod/use-attachment-uploader', '@whatsapp_connector/chatroom_mod/conversation-model', '@whatsapp_connector/chatroom_mod/message-model', '@whatsapp_connector/chatroom_mod/user-model', '@whatsapp_connector/chatroom_mod/attachment-list', '@whatsapp_connector/chatroom_mod/file-uploader', '@whatsapp_connector/chatroom_mod/story-dialog'], function (require) {
    'use strict'; let __exports = {}; const { browser } = require('@web/core/browser/browser')
    const { CheckBox } = require('@web/core/checkbox/checkbox')
    const { useAutofocus } = require('@web/core/utils/hooks')
    const { Transition } = require('@web/core/transition')
    const { SelectMenu } = require('@web/core/select_menu/select_menu')
    const { Component, useRef, useState, useEffect, onWillStart, onWillUpdateProps } = require('@odoo/owl')
    const { useBus } = require('@web/core/utils/hooks')
    const { Emojis } = require('@whatsapp_connector/chatroom_mod/emojis')
    const { ActivityButton } = require('@whatsapp_connector/chatroom_mod/activity-button')
    const { useAttachmentUploader } = require('@whatsapp_connector/chatroom_mod/use-attachment-uploader')
    const { ConversationModel } = require('@whatsapp_connector/chatroom_mod/conversation-model')
    const { MessageModel } = require('@whatsapp_connector/chatroom_mod/message-model')
    const { UserModel } = require('@whatsapp_connector/chatroom_mod/user-model')
    const { AttachmentList } = require('@whatsapp_connector/chatroom_mod/attachment-list')
    const { FileUploader } = require('@whatsapp_connector/chatroom_mod/file-uploader')
    const { Message } = require('@whatsapp_connector/chatroom_mod/story-dialog')
    const Toolbox = __exports.Toolbox = class Toolbox extends Component {
        setup() {
            super.setup()
            this.env
            this.props
            this.state = useState(this.getInitState())
            this.attachmentUploader = useAttachmentUploader({ onFileUploaded: this.onAddAttachment.bind(this), buildFormData: this.buildFormDataAttachment.bind(this), })
            this.langs = {}
            this.inputRef = useRef('inputRef')
            this.emojisBtnRef = useRef('emojisBtnRef')
            this.sendBtnRef = useRef('sendBtnRef')
            this.attachBtnRef = useRef('attachBtnRef')
            this.releaseBtnRef = useRef('releaseBtnRef')
            this.inputLangRef = useRef('inputLangRef')
            this.toolboxRef = useRef('toolboxRef')
            this.allInputs = [this.inputRef, this.inputLangRef, this.emojisBtnRef]
            this.wizardAction = null
            useBus(this.env.chatBus, 'setInputText', this.setInputText.bind(this))
            useBus(this.env.chatBus, 'quoteMessage', this.setQuoteMessage.bind(this))
            useAutofocus('inputRef')
            onWillStart(this.willStart.bind(this))
            useEffect(this.enableDisplabeAttachBtn.bind(this), () => [this.state.attachments])
            onWillUpdateProps(async (props) => {
                await this.updateLangs(props)
                if (this.props?.selectedConversation !== props?.selectedConversation) { this.env.chatBus.trigger('quoteMessage', null) }
            })
        }
        getInitState() { return { attachments: [], showTraductor: browser.localStorage.getItem('chatroomShowTraductor') === 'true', lang: undefined, message: null, } }
        async willStart() {
            const { orm } = this.env.services
            const data = await orm.call(this.env.chatModel, 'check_object_reference', ['', 'acrux_chat_message_wizard_action'], { context: this.context })
            this.wizardAction = data[1]
            await this.updateLangs(this.props)
        }
        async updateLangs(props) {
            if (props.selectedConversation?.allowedLangIds.length > 0) {
                const langIds = props.selectedConversation.allowedLangIds.filter(lang => !this.langs[lang])
                if (langIds.length > 0) {
                    const allowedLangIds = await this.env.services.orm.call('res.lang', 'name_search', [], { args: [['id', 'in', langIds]], context: { ...this.env.context, active_test: false }, })
                    for (const lang of allowedLangIds) { this.langs[lang[0]] = lang[1] }
                }
                this.state.lang = props.selectedConversation.allowedLangIds[0]
            } else { this.state.lang = undefined }
        }
        get conversationMine() { return this.props.selectedConversation?.isCurrent() ? '' : 'd-none' }
        get conversationNotMine() { return this.props.selectedConversation?.isCurrent() ? 'd-none' : '' }
        get allowSign() {
            const { selectedConversation: conv } = this.props
            return (conv?.isCurrent() && conv.allowSigning ? '' : 'd-none')
        }
        get allowTranslate() { return this.canTranslate ? '' : 'd-none' }
        get hasManyLangs() {
            const { selectedConversation: conv } = this.props
            return this.canTranslate && conv.allowedLangIds.length > 1 ? '' : 'd-none'
        }
        get canTranslate() {
            const { selectedConversation: conv } = this.props
            return !!conv?.allowedLangIds?.length && this.env.canTranslate()
        }
        get langProps() {
            const { allowedLangIds } = this.props?.selectedConversation || { allowedLangIds: [] }
            const out = { choices: allowedLangIds.map(value => { return { value, label: this.langs[value] } }), required: true, searchable: true, onSelect: value => { this.state.lang = value }, value: this.state.lang, }
            return out
        }
        async blockClient() { if (this.props.selectedConversation) { try { await this.props.selectedConversation.block() } catch (_e) { } } }
        async releaseClient() { if (this.props.selectedConversation?.isCurrent()) { await this.props.selectedConversation.release() } }
        async sendMessage(event) {
            this.inputRef.el.disabled = true
            this.sendBtnRef.el.disabled = true
            if (this.inputLangRef.el) { this.inputLangRef.el.disabled = true }
            const outMessages = []
            let options = { from_me: true }, firstAttach
            let text = this.inputRef.el.value.trim()
            const attachments = [...this.state.attachments]
            const attachmentsSent = []
            let traduction = ''
            if (this.state.lang && this.env.canTranslate() && this.inputLangRef.el) { traduction = this.inputLangRef.el.value.trim() }
            if (event) {
                event.preventDefault()
                event.stopPropagation()
            }
            if ('' !== traduction) { options.traduction = traduction }
            if ('' != text) {
                options.ttype = 'text'
                options.text = text
            }
            if (attachments.length) {
                firstAttach = attachments.shift()
                options = this.setAttachmentValues2Message(options, firstAttach)
            }
            try {
                this.env.services.ui.block()
                if (options.ttype) {
                    options = this.sendMessageHook(options)
                    outMessages.push(await this.props.selectedConversation.createMessage(options))
                    await this.postCreateMessage(outMessages[outMessages.length - 1])
                    if (options.res_model === 'ir.attachment') { attachmentsSent.push(options.res_model_obj) }
                    text = traduction = ''
                    for await (const attachment of attachments) {
                        options = this.setAttachmentValues2Message({ from_me: true }, attachment)
                        options = this.sendMessageHook(options)
                        outMessages.push(await this.props.selectedConversation.createMessage(options))
                        await this.postCreateMessage(outMessages[outMessages.length - 1])
                        attachmentsSent.push(attachment)
                    }
                }
            } finally {
                this.inputRef.el.disabled = false
                this.sendBtnRef.el.disabled = false
                if (this.inputLangRef.el) { this.inputLangRef.el.disabled = false }
                this.state.attachments = [firstAttach, ...attachments].filter(attach => attach && !attachmentsSent.includes(attach))
                this.enableDisplabeAttachBtn()
                this.env.chatBus.trigger('setInputText', [text, traduction])
                this.env.services.ui.unblock()
            }
            return outMessages
        }
        async postCreateMessage() { if (this.state.message) { this.env.chatBus.trigger('quoteMessage', null) } }
        setAttachmentValues2Message(options, attachment) {
            if (attachment.mimetype.includes('image')) { options.ttype = 'image' } else if (attachment.mimetype.includes('audio')) { options.ttype = 'audio' } else if (attachment.mimetype.includes('video')) { options.ttype = 'video' } else { options.ttype = 'file' }
            options.res_model = 'ir.attachment'
            options.res_id = attachment.id
            options.res_model_obj = attachment
            return options
        }
        onAddAttachment(attachment) { this.state.attachments = [...this.state.attachments, attachment] }
        async unlinkAttachment(attachment) {
            await this.attachmentUploader.unlink(attachment)
            this.state.attachments = this.state.attachments.filter(e => e.id !== attachment.id)
        }
        buildFormDataAttachment(formData) {
            formData.append('conversation_id', this.props.selectedConversation.id)
            formData.append('connector_type', this.props.selectedConversation.connectorType)
        }
        sendMessageHook(options) {
            if (this.state.message) { options.quote_id = this.state.message.exportToJson() }
            return options
        }
        onKeypress(event) {
            if (event.which === 13 && !event.shiftKey) {
                event.preventDefault()
                event.stopPropagation()
                if (event.currentTarget.classList.contains('o_chat_toolbox_text_translated')) { this.onTranslate().then(() => this.inputRef.el.focus()) } else { this.sendMessage() }
            }
        }
        onKeydown(event) { if (event.which === 27) { this.env.chatBus.trigger('quoteMessage', null) } }
        onInput(event) {
            const { target: textarea } = event
            if (textarea.value.trim()) {
                textarea.style.height = 'auto'
                const newHeight = textarea.scrollHeight - (textarea.offsetHeight - textarea.clientHeight)
                textarea.style.height = Math.min(newHeight, 60) + 'px'; textarea.style.overflow = (newHeight > 60) ? 'auto' : 'hidden'
            } else {
                textarea.style.removeProperty('height')
                textarea.style.removeProperty('overflow')
            }
        }
        async onPaste(event) {
            let clipboardData = event.clipboardData || window.clipboardData
            if (clipboardData) {
                const files = []
                for (const item of clipboardData.items) {
                    if (item.kind === 'file') {
                        event.stopPropagation()
                        event.preventDefault()
                        files.push(item.getAsFile())
                    }
                }
                return Promise.all(files.map(file => this.attachmentUploader.uploadFile(file))).catch(() => { })
            }
        }
        toggleEmojis() {
            if (this.popoverCloseFn) {
                this.popoverCloseFn()
                this.popoverCloseFn = null
            } else {
                this.popoverCloseFn = this.env.services.popover.add(this.emojisBtnRef.el, Emojis, {
                    onClick: this.addEmojis.bind(this), close: () => {
                        if (this.popoverCloseFn) {
                            this.popoverCloseFn()
                            this.popoverCloseFn = null
                        }
                    }
                }, { position: 'top' })
            }
        }
        addEmojis(event) {
            const emoji = event.target.dataset.source
            const startPos = this.inputRef.el.selectionStart; const endPos = this.inputRef.el.selectionEnd; const firstText = this.inputRef.el.value.substring(0, startPos)
            const lastText = this.inputRef.el.value.substring(endPos, this.inputRef.el.value.length)
            this.env.chatBus.trigger('setInputText', `${firstText}${emoji}${lastText}`)
            this.inputRef.el.focus()
            this.inputRef.el.selectionStart = startPos + emoji.length
            this.inputRef.el.selectionEnd = startPos + emoji.length
        }
        async updateSigning(newValue) {
            await this.updateUserPreference({ chatroom_signing_active: newValue })
            this.props.user.signingActive = newValue
        }
        async updateUserPreference(preference) { await this.env.services.orm.write('res.users', [this.env.services.user.userId], preference, { context: this.env.context }) }
        needDisableInput(attachment) {
            let out
            if (this.props.selectedConversation?.isOwnerFacebook()) { if (this.props.selectedConversation.isWabaExtern()) { out = attachment.mimetype.includes('audio') } else { out = true } } else { out = !(attachment.mimetype.includes('image') || attachment.mimetype.includes('video')) }
            return out
        }
        enableDisplabeAttachBtn() {
            if (this.state.attachments.length) {
                const attachment = this.state.attachments[0]
                if (this.needDisableInput(attachment)) {
                    this.env.chatBus.trigger('setInputText', '')
                    this.allInputs.filter(e => e.el).forEach(e => e.el.disabled = true)
                    this.sendBtnRef.el.focus()
                } else { this.allInputs.filter(e => e.el).forEach(e => e.el.disabled = false) }
                this.sendBtnRef.el.focus()
            } else {
                this.allInputs.filter(e => e.el).forEach(e => e.el.disabled = false)
                this.inputRef.el.focus()
            }
        }
        setInputText({ detail }) {
            const [text, traduction] = Array.isArray(detail) ? detail : [detail]
            if (!(this.inputRef.el.disabled || this.inputRef.el.readonly)) {
                this.inputRef.el.value = text
                this.onInput({ target: this.inputRef.el })
                if (this.inputLangRef.el) {
                    this.inputLangRef.el.value = traduction || ''
                    this.onInput({ target: this.inputLangRef.el })
                }
            }
        }
        async setQuoteMessage({ detail: message }) {
            if (message) {
                const data = message.exportToJson()
                if (data.quote_id) { delete (data.quote_id) }
                if (data.metadata_type) { delete (data.metadata_type) }
                if (data.button_ids) { delete (data.button_ids) }
                const quote = new MessageModel(this.props.selectedConversation, data)
                await quote.buildExtraObj()
                this.state.message = quote
                this.inputRef.el.focus()
            } else { this.state.message = null }
        }
        async onTranslate() {
            const text = this.inputLangRef.el.value.trim()
            const traduction = await this.doTranslate(text)
            if (text && traduction) { this.env.chatBus.trigger('setInputText', [traduction, text]) }
        }
        async doTranslate(text) {
            let traduction = null
            if (text && this.state.lang && this.canTranslate) {
                const lang_id = this.state.lang
                const ai_config_id = this.env.canTranslate()
                const conversation_id = this.props.selectedConversation.id
                const { orm } = this.env.services
                traduction = await orm.call('acrux.chat.message', 'translate_text', [ai_config_id, text, lang_id, conversation_id], { context: this.env.context })
            }
            return traduction
        }
        async sendWizard() { await this.env.services.action.doAction(this.wizardAction, { additionalContext: { default_conversation_id: this.props.selectedConversation.id, full_name: true } }) }
        openTab(ev) {
            const target = ev.currentTarget || ev.target
            if (target) {
                const tabKey = target.getAttribute('tab-key')
                this.env.chatBus.trigger('selectTab', tabKey)
                this.env.chatBus.trigger('mobileNavigate', 'lastSide')
            }
        }
        async delegateConversation() {
            const { orm } = this.env.services
            await orm.call(this.env.chatModel, 'delegate_conversation', [[this.props.selectedConversation.id]], { context: this.context })
        }
        onToggleTraductor() {
            this.state.showTraductor = !this.state.showTraductor
            browser.localStorage.setItem('chatroomShowTraductor', `${this.state.showTraductor}`)
        }
    }
    Object.assign(Toolbox, { template: 'chatroom.Toolbox', props: { user: UserModel.prototype, selectedConversation: ConversationModel.prototype, }, components: { CheckBox, Emojis, AttachmentList, FileUploader, ActivityButton, Transition, SelectMenu, Message, } })
    return __exports;
});;
