odoo.define('@whatsapp_connector/chatroom_mod/conversation-list', ['@web/core/l10n/translation', '@web/core/browser/browser', '@web/core/transition', '@odoo/owl', '@web/core/utils/hooks', '@whatsapp_connector/chatroom_mod/chatroom-header', '@whatsapp_connector/chatroom_mod/conversation', '@whatsapp_connector/chatroom_mod/chat-search', '@whatsapp_connector/chatroom_mod/conversation-card', '@whatsapp_connector/chatroom_mod/conversation-model'], function (require) {
    'use strict'; let __exports = {}; const { _t } = require('@web/core/l10n/translation')
    const { browser } = require('@web/core/browser/browser')
    const { Transition } = require('@web/core/transition')
    const { Component, useState, useEffect, useRef } = require('@odoo/owl')
    const { useBus } = require('@web/core/utils/hooks')
    const { ChatroomHeader } = require('@whatsapp_connector/chatroom_mod/chatroom-header')
    const { Conversation } = require('@whatsapp_connector/chatroom_mod/conversation')
    const { ChatSearch } = require('@whatsapp_connector/chatroom_mod/chat-search')
    const { ConversationCard } = require('@whatsapp_connector/chatroom_mod/conversation-card')
    const { ConversationModel } = require('@whatsapp_connector/chatroom_mod/conversation-model')
    const ConversationList = __exports.ConversationList = class ConversationList extends Component {
        setup() {
            super.setup()
            this.env; this.props
            this.conversationFilterHolder = _t('Search')
            this.state = useState(this.getInitState())
            this.containerRef = useRef('containerRef')
            useBus(this.env.chatBus, 'searchConversations', this.searchConversations.bind(this))
            useBus(this.env.chatBus, 'cleanSearch', this.closeFilter.bind(this))
            useBus(this.env.chatBus, 'closeChatFilter', this.closeChatFilter.bind(this))
            useBus(this.env.chatBus, 'initAndNotifyConversation', this.initAndNotify.bind(this))
            useBus(this.env.chatBus, 'searchConversations', this.searchConversations.bind(this))
            useEffect(() => { this.filterAndOrderConversations() }, () => [this.props.conversations])
        }
        getInitState() {
            const conversationOrder = browser.localStorage.getItem('chatroomConversationOrder')
            return { conversations: [], isChatFiltering: false, chatFilterResponse: [], chatsFiltered: [], conversationOrder: conversationOrder && JSON.parse(conversationOrder) || { current: 'desc' }, filterActivity: false, filterPending: false, filterMine: true, showWaitingHeader: false, modeSimple: false, countNewMsg: 0, }
        }
        getFilters() { return { filterActivity: this.state.filterActivity, filterPending: this.state.filterPending, filterMine: this.state.filterMine, } }
        changeViewMode() {
            if (this.state.modeSimple) { this.containerRef.el.classList.remove('simple') } else { this.containerRef.el.classList.add('simple') }
            this.state.modeSimple = !this.state.modeSimple
        }
        onFilter(event) {
            const target = event.currentTarget || event.target
            if (target) {
                const filter = target.getAttribute('filter-key')
                this.state[filter] = !this.state[filter]
                if (this.state.isChatFiltering) {
                    let chatsFiltered = this.state.chatFilterResponse.map(item => { return { name: item.name, values: item.values.map(item2 => { return { name: item2.name, values: item2.values.filter(this.evaluateFilter.bind(this)) } }) } })
                    chatsFiltered = chatsFiltered.map(item => { return { name: item.name, values: item.values.filter(item2 => item2.values.length > 0) } })
                    chatsFiltered = chatsFiltered.filter(item => item.values.length > 0)
                    this.state.chatsFiltered = chatsFiltered
                } else { this.filterAndOrderConversations() }
            }
        }
        onOrder(event) {
            const target = event.currentTarget || event.target
            if (target) {
                const orderChange = { desc: 'lock_desc', lock_desc: 'asc', asc: 'lock_asc', lock_asc: 'desc' }
                const fildName = 'current'
                this.state.conversationOrder[fildName] = orderChange[this.state.conversationOrder[fildName]]
                browser.localStorage.setItem('chatroomConversationOrder', JSON.stringify(this.state.conversationOrder))
                this.filterAndOrderConversations()
            }
        }
        evaluateFilter(conv) {
            let out = true
            if (out && this.state.filterPending) { out = conv.countNewMsg > 0 }
            if (out && this.state.filterMine) { out = conv.isMine() || ['new'].includes(conv.status) }
            if (out && this.state.filterActivity) { out = conv.oldesActivityDate && conv.oldesActivityDate < luxon.DateTime.now() }
            return out
        }
        filterAndOrderConversations() {
            const conversations = this.props.conversations.filter(this.evaluateFilter.bind(this))
            const order = this.state.conversationOrder
            const orderFn = (a, b, criteria) => {
                let out
                if (criteria === 'desc') { out = a.lastActivity < b.lastActivity } else { out = a.lastActivity > b.lastActivity }
                return out ? 1 : -1
            }
            if (['asc', 'desc'].includes(order.current)) { conversations.sort((a, b) => orderFn(a, b, order.current)) }
            this.state.conversations = conversations
            this.state.countNewMsg = conversations.filter(conv => conv.countNewMsg > 0).length
        }
        getSortIcon(str) {
            const orderIcon = { desc: 'fa-arrow-up', asc: 'fa-arrow-down', lock_desc: 'fa-lock', lock_asc: 'fa-lock' }
            return orderIcon[str]
        }
        getSortTitle(str) {
            const orderTitle = { desc: _t('New Chats Up'), asc: _t('New Chats Down'), lock_desc: _t('Static Order'), lock_asc: _t('Static Order'), }
            return orderTitle[str]
        }
        async searchConversations({ detail: { search } }) {
            search = search.trim()
            const result = await this.env.services.orm.call(this.env.chatModel, 'conversation_filtering_js', [search, this.getFilters()], { context: this.env.context },)
            const keys = Object.keys(result).filter(key => result[key].length > 0)
            this.state.isChatFiltering = true
            this.state.chatFilterResponse = keys.map(key => { return { name: key, values: result[key].map(val => { return { name: val.name, values: val.values.map(conv => new ConversationModel(this, conv)) } }) } })
            this.state.chatsFiltered = [...this.state.chatFilterResponse]
        }
        closeFilter() {
            this.state.isChatFiltering = false
            this.state.chatFilterResponse = []
            this.state.chatsFiltered = []
            this.filterAndOrderConversations()
        }
        closeChatFilter() { this.state.isChatFiltering = false }
        async initAndNotify({ detail: { id } }) {
            this.state.isChatFiltering = false
            return this.env.services.orm.call(this.env.chatModel, 'init_and_notify', [[id]], { context: this.env.context },)
        }
        async createConversation() {
            const action = { type: 'ir.actions.act_window', name: _t('Create'), view_type: 'form', view_mode: 'form', res_model: this.env.chatModel, views: [[false, 'form']], target: 'new', context: { ...this.env.context, chat_full_edit: true, default_is_odoo_created: true }, }
            const onSave = async record => { if (record?.data?.id) { await Promise.all([this.env.services.action.doAction({ type: 'ir.actions.act_window_close' }), Promise.resolve(() => this.env.chatBus.trigger('initAndNotifyConversation', record.data)), Promise.resolve(() => this.env.chatBus.trigger('closeChatFilter')),]) } }
            await this.env.services.action.doAction(action, { props: { onSave } })
        }
        onToggleShowWaitingHeader() { this.state.showWaitingHeader = !this.state.showWaitingHeader }
        get waintingConversations() {
            const current = new Set(this.currentConversations)
            return this.state.conversations.filter(conv => !current.has(conv))
        }
        get currentConversations() {
            let out = []
            if (this.env.isAdmin()) { out = this.state.conversations.filter(conv => conv.status === 'current') } else { out = this.state.conversations.filter(conv => conv.isCurrent()) }
            return out
        }
    }
    Object.assign(ConversationList, { props: { mobileNavigate: Function, conversations: { type: Array, element: { type: ConversationModel.prototype } }, selectedConversation: { type: ConversationModel.prototype, optional: true }, }, components: { ChatroomHeader, Conversation, ChatSearch, ConversationCard, Transition, }, template: 'chatroom.ConversationList', })
    return __exports;
});;
