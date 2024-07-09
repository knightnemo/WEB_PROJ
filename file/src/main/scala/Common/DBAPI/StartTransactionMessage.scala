package Common.DBAPI

import Common.API.API
import Global.ServiceCenter.dbManagerServiceCode

// StartTransactionMessage case class
case class StartTransactionMessage() extends API[String](dbManagerServiceCode)