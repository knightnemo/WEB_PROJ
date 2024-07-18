import { NotificationMessage } from 'Plugins/NotificationAPI/NotificationMessage'

export class DeleteNotificationMessage extends NotificationMessage {
    id: string;

    constructor(id: string) {
        super();
        this.id = id;
    }
}