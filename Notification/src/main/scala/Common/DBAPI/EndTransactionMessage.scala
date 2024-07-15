package Common.DBAPI

import Common.API.API
import Global.ServiceCenter.dbManagerServiceCode

case class EndTransactionMessage(commit: Boolean) extends API[String](dbManagerServiceCode)