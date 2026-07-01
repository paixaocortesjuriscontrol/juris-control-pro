UPDATE classificacao_turmas_tst SET nome = 'Vice-Presidência' WHERE nome = 'Vice-Presiência';
UPDATE dados_benner SET turma = 'Vice-Presidência' WHERE turma = 'Vice-Presiência';
UPDATE dados_benner SET turma = regexp_replace(turma, 'Vice[\s-]*Presi[êe]ncia', 'Vice-Presidência', 'gi') WHERE turma ~* 'Vice[\s-]*Presi[êe]ncia' AND turma <> 'Vice-Presidência';