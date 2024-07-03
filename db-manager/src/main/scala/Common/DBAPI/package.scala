package Common

import Common.API.{PlanContext, TraceID}
import Common.Object.{ParameterList, SqlParameter}
import cats.effect.*
import io.circe.{Decoder, Encoder, HCursor, Json}
import io.circe.generic.auto.*
import org.joda.time.DateTime
import io.circe.parser.decode
import org.http4s.client.Client
import org.joda.time.format.ISODateTimeFormat

package object DBAPI {
  // 隐式转换：将DateTime转换为String（表示自纪元以来的毫秒数）
  given Conversion[DateTime, String] = dateTime => {
    dateTime.getMillis.toString
  }

  // 隐式转换：将String（表示自纪元以来的毫秒数）转换为DateTime
  given Conversion[String, DateTime] = time => {
    new DateTime(time.toLong)
  }

  /**
   * 启动事务
   *
   * @param block 要执行的代码块，带有PlanContext上下文
   * @param encoder 隐式编码器，用于编码结果
   * @param ctx 当前的PlanContext
   * @return 包含结果的IO操作
   */
  def startTransaction[A](block: PlanContext ?=> IO[A])(using encoder: Encoder[A], ctx: PlanContext): IO[A] = {
    // 创建新的上下文，事务层级+1
    given newContext: PlanContext = ctx.copy(transactionLevel = ctx.transactionLevel + 1)

    // 定义开始事务的操作
    val startTransactionAction = if (ctx.transactionLevel == 0) {
      StartTransactionMessage().send // 假设此方法返回IO[Unit]或类似的结果
    } else {
      IO.unit // 已经在事务中，不需要操作
    }

    // 定义提交或回滚操作
    def commitOrRollbackAction(result: Either[Throwable, A]): IO[A] =
      result match {
        case Left(exception: DidRollbackException) =>
          IO.raiseError(exception)   // 如果问题已经处理过了，不需要额外处理
        case Left(exception) =>
          EndTransactionMessage(false).send >> IO.raiseError(DidRollbackException(exception)) // 出现问题，回滚
        case Right(value) =>
          if (ctx.transactionLevel == 0)
            // 如果是第一层事务，结束事务
            EndTransactionMessage(true).send.as(value)
          else IO.pure(value) // 否则不结束事务，返回结果
      }

    for {
      _ <- startTransactionAction // 如果是第一层，启动事务
      result <- block(using newContext).attempt // 使用新的事务上下文执行代码块
      finalResult <- commitOrRollbackAction(result) // 根据结果提交或回滚事务
    } yield finalResult
  }

  // 回滚操作
  def rollback(): IO[Unit] = IO.raiseError(RollbackException("Rollback"))

  // 初始化数据库模式
  def initSchema(schemaName: String)(using Encoder[InitSchemaMessage], PlanContext): IO[String] =
    InitSchemaMessage(schemaName).send

  // 读取数据库行，返回Json列表
  def readDBRows(sqlQuery: String, parameters: List[SqlParameter])(using Encoder[ReadDBRowsMessage], PlanContext): IO[List[Json]] =
    ReadDBRowsMessage(sqlQuery, parameters).send

  // 读取数据库中的整数值
  def readDBInt(sqlQuery: String, parameters: List[SqlParameter])(using context: PlanContext): IO[Int] =
    for {
      resultParam: String <- ReadDBValueMessage(sqlQuery, parameters).send
      convertedResult = resultParam.toInt
    } yield convertedResult

  // 读取数据库中的字符串值
  def readDBString(sqlQuery: String, parameters: List[SqlParameter])(using context: PlanContext): IO[String] =
    for {
      resultParam: String <- ReadDBValueMessage(sqlQuery, parameters).send
    } yield resultParam

  // 读取数据库中的布尔值
  def readDBBoolean(sqlQuery: String, parameters: List[SqlParameter])(using context: PlanContext): IO[Boolean] =
    for {
      resultParam: String <- ReadDBValueMessage(sqlQuery, parameters).send
      convertedResult = resultParam.startsWith("t")
    } yield convertedResult

  // 写入数据库
  def writeDB(sqlQuery: String, parameters: List[SqlParameter])(using Encoder[WriteDBMessage], PlanContext): IO[String] =
    WriteDBMessage(sqlQuery, parameters).send

  // 批量写入数据库
  def writeDBList(sqlQuery: String, parameters: List[ParameterList])(using Encoder[WriteDBListMessage], PlanContext): IO[String] =
    WriteDBListMessage(sqlQuery, parameters).send

  // 隐式解码器：将Json解析为DateTime
  implicit val dateTimeDecoder: Decoder[DateTime] = new Decoder[DateTime] {
    private val formatter = ISODateTimeFormat.dateTimeParser()

    override def apply(c: HCursor): Decoder.Result[DateTime] = {
      c.as[String].map(formatter.parseDateTime)
    }
  }

  // 从Json中解码指定字段
  def decodeField[T: Decoder](json: Json, field: String): T = {
    json.hcursor.downField(snakeToCamel(field)).as[T].fold(throw _, identity)
  }

  // 从Json中解码指定类型
  def decodeType[T: Decoder](json: Json): T = {
    json.as[T].fold(throw _, identity)
  }

  // 从Json中解码指定类型，返回IO操作
  def decodeTypeIO[T: Decoder](json: Json): IO[T] = {
    json.as[T].fold(IO.raiseError, IO.pure)
  }

  // 从字符串中解码指定类型
  def decodeType[T: Decoder](st: String): T = {
    decode[T](st).fold(throw _, identity)
  }

  // 从字符串中解码指定类型，返回IO操作
  def decodeTypeIO[T: Decoder](st: String): IO[T] = {
    decode[T](st).fold(IO.raiseError, IO.pure)
  }

  // 将蛇形命名转换为驼峰命名
  def snakeToCamel(snake: String): String = {
    snake.split("_").toList match {
      case head :: tail =>
        head + tail.map {
          case "id" => "ID"
          case other => other.capitalize
        }.mkString
      case Nil => ""
    }
  }
}
