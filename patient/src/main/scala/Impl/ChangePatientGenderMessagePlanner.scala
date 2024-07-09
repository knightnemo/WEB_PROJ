package Impl

import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.PatientAPI.ChangePatientGenderMessage
import cats.effect.IO
import io.circe.generic.auto.*

case class ChangePatientGenderMessagePlanner(userName: String, newGender: String, override val planContext: PlanContext) extends Planner[String]:
  override def plan(using PlanContext): IO[String] = {
    for {
      // 验证用户是否存在
      userExists <- readDBBoolean(
        s"SELECT EXISTS(SELECT 1 FROM ${schemaName}.patient WHERE user_name = ?)",
        List(SqlParameter("String", userName))
      )
      result <- if (userExists) {
        // 更新性别信息
        writeDB(
          s"UPDATE ${schemaName}.patient SET gender = ? WHERE user_name = ?",
          List(SqlParameter("String", newGender), SqlParameter("String", userName))
        ).map(_ => s"Gender updated successfully for user: $userName")
      } else {
        IO.pure(s"User not found: $userName")
      }
    } yield result
  }
