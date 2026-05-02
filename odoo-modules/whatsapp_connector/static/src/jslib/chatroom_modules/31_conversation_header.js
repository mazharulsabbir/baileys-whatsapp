odoo.define('@whatsapp_connector/chatroom_mod/conversation-header', ['@odoo/owl', '@whatsapp_connector/chatroom_mod/conversation-model', '@whatsapp_connector/chatroom_mod/conversation-name'], function (require) {
    'use strict'; let __exports = {}; const { Component } = require('@odoo/owl')
    const { ConversationModel } = require('@whatsapp_connector/chatroom_mod/conversation-model')
    const { ConversationName } = require('@whatsapp_connector/chatroom_mod/conversation-name')
    const ConversationHeader = __exports.ConversationHeader = class ConversationHeader extends Component {
        setup() {
            super.setup()
            this.env
            this.props
        }
    }
    Object.assign(ConversationHeader, { template: 'chatroom.ConversationHeader', props: { selectedConversation: ConversationModel.prototype, }, components: { ConversationName } })
    return __exports;
});;
