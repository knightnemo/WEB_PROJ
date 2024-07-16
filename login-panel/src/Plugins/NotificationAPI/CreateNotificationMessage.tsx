// CreateNotificationMessage.tsx

import { NotificationMessage } from './NotificationMessage';

export class CreateNotificationMessage extends NotificationMessage {
    constructor(
        public id: string,
        public title: string,
        public content: string,
        public publisher: string,
        public publishTime: string,
        public recipients: string,
    ) {
        super();
    }


    toJSON(): object {
        return {
                id: this.id,
                title: this.title,
                content: this.content,
                publisher: this.publisher,
                publishTime: this.publishTime,
                recipients: this.recipients
        };
    }
}