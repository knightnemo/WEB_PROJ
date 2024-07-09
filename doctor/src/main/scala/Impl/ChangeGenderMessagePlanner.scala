package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.DoctorAPI.ChangeGenderMessage

case class ChangeGenderPlanner(userName: String, newGender: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    // 检查用户是否存在于数据库中
    val checkUserExists = readDBBoolean(
      s"SELECT EXISTS(SELECT 1 FROM ${schemaName}.user_name WHERE user_name = ?)",
      List(SqlParameter("String", userName))
    )

    checkUserExists.flatMap { exists =>
      if (!exists) {
        // 如果用户不存在，返回错误信息
        IO.raiseError(new Exception("user not found"))
      } else {
        // 如果用户存在，更新性别信息
        writeDB(
          s"UPDATE ${schemaName}.user_name SET gender = ? WHERE user_name = ?",
          List(
            SqlParameter("String", newGender),
            SqlParameter("String", userName)
          )
        ).map(_ => "Gender updated successfully") // 更新成功后返回成功信息
      }
    }
  }
