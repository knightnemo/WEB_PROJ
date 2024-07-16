import { NotificationMessage } from 'Plugins/NotificationAPI/NotificationMessage'

export class GetAllNotificationsMessage extends NotificationMessage {
    constructor() {
        super();
    }

    toJSON(): object {
        return {
        }; // 或者返回任何需要的参数
    }
}