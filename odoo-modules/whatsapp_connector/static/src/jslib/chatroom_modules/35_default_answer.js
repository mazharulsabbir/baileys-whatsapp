odoo.define('@whatsapp_connector/chatroom_mod/default-answer', ['@web/core/l10n/translation', '@web/core/errors/error_dialogs', '@odoo/owl', '@whatsapp_connector/chatroom_mod/conversation-model', '@whatsapp_connector/chatroom_mod/default-answer-model'], function (require) {
    'use strict'; let __exports = {}; const { _t } = require('@web/core/l10n/translation')
    const { WarningDialog } = require('@web/core/errors/error_dialogs')
    const { Component } = require('@odoo/owl')
    const { ConversationModel } = require('@whatsapp_connector/chatroom_mod/conversation-model')
    const { DefaultAnswerModel } = require('@whatsapp_connector/chatroom_mod/default-answer-model')
    const DefaultAnswer = __exports.DefaultAnswer = class DefaultAnswer extends Component {
        setup() {
            super.setup()
            this.env
            this.props
        }
        async sendAnswer(event) {
            let out = Promise.resolve()
            if (event) { event.target.disabled = true }
            if (this.props.selectedConversation && this.props.selectedConversation.isCurrent()) {
                let text, ttype = this.props.defaultAnswer.ttype
                if (ttype === 'code') {
                    ttype = 'text'
                    text = await this.env.services.orm.call('acrux.chat.default.answer', 'eval_answer', [[this.props.defaultAnswer.id], this.props.selectedConversation.id], { context: this.env.context })
                } else { if (this.props.defaultAnswer.text && '' !== this.props.defaultAnswer.text) { text = this.props.defaultAnswer.text } else { text = this.props.defaultAnswer.name } }
                const options = {
                    from_me: true, text: text, ttype: ttype, res_model: this.props.defaultAnswer.resModel, res_id: this.props.defaultAnswer.resId, button_ids: this.props.defaultAnswer.buttons.map(btn => {
                        const btn2 = { ...btn }
                        delete btn2.id
                        return btn2
                    }), chat_list_id: this.props.defaultAnswer.chatListRecord
                }
                if (ttype === 'text' && text) { this.env.chatBus.trigger('setInputText', text) } else { out = this.props.selectedConversation.createMessage(options) }
            } else { this.env.services.dialog.add(WarningDialog, { message: _t('You must select a conversation.') }) }
            return out.finally(() => { if (event) { event.target.disabled = false } })
        }
    }
    Object.assign(DefaultAnswer, { template: 'chatroom.DefaultAnswer', props: { selectedConversation: ConversationModel.prototype, defaultAnswer: DefaultAnswerModel.prototype, }, })
    return __exports;
});;
