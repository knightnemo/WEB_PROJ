import { NotificationMessage } from 'Plugins/NotificationAPI/NotificationMessage'

export class GetAllNotificationsMessage extends NotificationMessage {
    constructor() {
        super();
    }

    toJSON(): object {
        return {
        };
    }
}