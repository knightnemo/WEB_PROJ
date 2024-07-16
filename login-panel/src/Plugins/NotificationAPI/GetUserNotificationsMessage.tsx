import { NotificationMessage } from 'Plugins/NotificationAPI/NotificationMessage'

export class GetUserNotificationsMessage extends NotificationMessage {
    username: string;

    constructor(username: string) {
        super();
        this.username = username;
    }

    toJSON(): object {
        return {
            username: this.username
        };
    }
}