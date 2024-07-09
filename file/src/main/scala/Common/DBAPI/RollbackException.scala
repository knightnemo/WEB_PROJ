package Common.DBAPI

case class RollbackException(message: String) extends Exception(message)
